import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('OPENROUTER_URL') || 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set - AI calls will fail');
    }
  }

  async chat(
    model: string,
    messages: OpenRouterMessage[],
    temperature: number = 0.7,
    maxTokens: number = 2000,
  ): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(
          this.baseUrl,
          {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://smartcareer.app',
              'X-Title': 'SmartCareer Backend',
              'Content-Type': 'application/json',
            },
            timeout: 45000, // 45s timeout for larger responses
            maxRedirects: 0,
            responseType: 'json', // Explicitly expect JSON
          }
        )
      );

      // Validate response structure
      if (!response.data) {
        throw new Error('Empty response from OpenRouter (no data)');
      }

      if (!response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
        throw new Error(`Invalid response structure: missing choices. Got keys: ${Object.keys(response.data).join(', ')}`);
      }

      const message = response.data.choices[0].message;
      if (!message || typeof message !== 'object') {
        throw new Error('Invalid response: choices[0].message is missing or not an object');
      }

      const content = message.content;
      if (typeof content !== 'string') {
        throw new Error(`Invalid content type: expected string, got ${typeof content}`);
      }

      if (content.length === 0) {
        throw new Error('Empty content returned from OpenRouter');
      }

      this.logger.debug(`OpenRouter success from ${model}: content_len=${content.length}, finish_reason=${response.data.choices[0].finish_reason || 'none'}`);

      return response.data as OpenRouterResponse;
    } catch (error: any) {
      // Extract more detailed error information
      let errorDetail = error.message;
      if (error.response) {
        const { status, statusText, data } = error.response;
        errorDetail = `HTTP ${status} ${statusText}`;
        if (data) {
          try {
            errorDetail += ` - ${JSON.stringify(data).substring(0, 200)}`;
          } catch {
            errorDetail += ` - ${String(data).substring(0, 200)}`;
          }
        }
      } else if (error.request) {
        errorDetail = `No response received: ${error.message}`;
      }

      this.logger.error(`OpenRouter API error with model ${model}:`, {
        message: errorDetail,
        code: error.code,
        url: error.config?.url,
      });
      throw new Error(`OpenRouter failed (${model}): ${errorDetail}`);
    }
  }

  async chatWithRetry(
    models: string[],
    messages: OpenRouterMessage[],
    temperature: number = 0.7,
    maxTokens: number = 2000,
    maxRetriesPerModel: number = 2,
  ): Promise<OpenRouterResponse> {
    let lastError: Error | null = null;

    for (const model of models) {
      for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
        try {
          this.logger.log(`Attempting AI call with model: ${model} (attempt ${attempt + 1})`);
          const result = await this.chat(model, messages, temperature, maxTokens);
          this.logger.log(`AI call successful with model: ${model}`);
          return result;
        } catch (error: any) {
          lastError = error;

          const status = error.response?.status;
          const isRetryable = status === 429 || status === 502 || status === 503 || status === 504;

          if (!isRetryable || attempt === maxRetriesPerModel) {
            this.logger.warn(`Model ${model} failed, moving to next model or fallback`);
            break;
          }

          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 250, 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All AI models failed');
  }
}
