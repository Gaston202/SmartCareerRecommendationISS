import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const HATEOAS = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.hateoasLinks || [];
  },
);

export interface HateoasLink {
  rel: string;
  href: string;
  method?: string;
}
