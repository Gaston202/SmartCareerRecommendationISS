"""
Base agent class for AI v2 module.

Defines the interface and common functionality for all agents.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime

from ..schemas import AgentOutput, AgentType
from ..utils import get_logger

logger = get_logger(__name__)


class BaseAgent(ABC):
    """
    Abstract base class for all agents in the AI pipeline.
    
    All agents should inherit from this class and implement the run() method.
    This ensures consistent interface and behavior across the pipeline.
    
    Attributes:
        agent_type (AgentType): Type of this agent
        name (str): Human-readable name of the agent
    """

    def __init__(self, agent_type: AgentType, name: str):
        """
        Initialize a base agent.
        
        Args:
            agent_type (AgentType): Type classification of this agent
            name (str): Human-readable name
        """
        self.agent_type = agent_type
        self.name = name
        self.logger = get_logger(f"{__name__}.{self.__class__.__name__}")

    @abstractmethod
    def run(self, input_data: Dict[str, Any]) -> AgentOutput:
        """
        Execute the agent's main logic.
        
        This method must be implemented by subclasses.
        
        Args:
            input_data (Dict[str, Any]): Input data for the agent
        
        Returns:
            AgentOutput: Structured output from the agent
        
        Raises:
            NotImplementedError: If not overridden in subclass
        """
        raise NotImplementedError("Subclasses must implement the run() method")

    def _create_output(
        self,
        success: bool,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> AgentOutput:
        """
        Create a standardized AgentOutput.
        
        Helper method to ensure consistent output formatting.
        
        Args:
            success (bool): Whether execution was successful
            data (Optional[Dict[str, Any]]): Output data
            error (Optional[str]): Error message if applicable
        
        Returns:
            AgentOutput: Standardized output object
        """
        return AgentOutput(
            agent_type=self.agent_type,
            success=success,
            data=data or {},
            error=error,
        )

    def _log_execution(self, message: str, level: str = "info") -> None:
        """
        Log agent execution events.
        
        Args:
            message (str): Message to log
            level (str): Log level ("info", "warning", "error")
        """
        log_func = getattr(self.logger, level, self.logger.info)
        log_func(f"[{self.name}] {message}")
