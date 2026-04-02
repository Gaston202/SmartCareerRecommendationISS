"""
Deployment Phase Configuration
Manages feature flags and deployment modes for phased rollout
"""

import os
from enum import Enum
from dataclasses import dataclass
from typing import List


class DeploymentPhase(Enum):
    """Deployment phases"""
    POC = "poc"           # Phase 1: Proof of Concept
    PILOT = "pilot"       # Phase 2: Pilot Program
    PRODUCTION = "prod"   # Phase 3: Production


class AgentToggle(Enum):
    """Agent enable/disable flags"""
    PROFILE = "ENABLE_PROFILE_AGENT"
    CAREER = "ENABLE_CAREER_AGENT"
    GAP = "ENABLE_GAP_AGENT"
    ROADMAP = "ENABLE_ROADMAP_AGENT"


@dataclass
class DeploymentConfig:
    """Configuration for current deployment phase"""
    phase: DeploymentPhase
    agents_enabled: dict  # {agent_name: bool}
    monitoring_enabled: bool
    health_check_enabled: bool
    error_rate_threshold: float  # Percentage
    latency_threshold_seconds: float
    pilot_user_ids: List[str] = None
    canary_rollout_percentage: float = 0.0
    auto_rollback_enabled: bool = False


def get_phase() -> DeploymentPhase:
    """Get current deployment phase from environment"""
    phase_str = os.environ.get("DEPLOYMENT_PHASE", "poc").lower()
    
    try:
        return DeploymentPhase(phase_str)
    except ValueError:
        raise ValueError(f"Invalid DEPLOYMENT_PHASE: {phase_str}")


def get_config() -> DeploymentConfig:
    """Get deployment configuration based on current phase"""
    phase = get_phase()
    
    configs = {
        DeploymentPhase.POC: {
            "phase": DeploymentPhase.POC,
            "agents_enabled": {
                "profile_agent": os.getenv("ENABLE_PROFILE_AGENT", "true").lower() == "true",
                "career_agent": os.getenv("ENABLE_CAREER_AGENT", "true").lower() == "true",
                "gap_agent": os.getenv("ENABLE_GAP_AGENT", "true").lower() == "true",
                "roadmap_agent": os.getenv("ENABLE_ROADMAP_AGENT", "true").lower() == "true",
            },
            "monitoring_enabled": False,
            "health_check_enabled": True,
            "error_rate_threshold": 0.15,  # 15% - lenient for PoC
            "latency_threshold_seconds": 10.0,
            "auto_rollback_enabled": False,
        },
        DeploymentPhase.PILOT: {
            "phase": DeploymentPhase.PILOT,
            "agents_enabled": {
                "profile_agent": True,
                "career_agent": True,
                "gap_agent": True,
                "roadmap_agent": True,
            },
            "monitoring_enabled": True,
            "health_check_enabled": True,
            "error_rate_threshold": 0.05,  # 5% - moderate threshold
            "latency_threshold_seconds": 15.0,
            "pilot_user_ids": os.getenv("PILOT_USER_IDS", "").split(",") if os.getenv("PILOT_USER_IDS") else [],
            "auto_rollback_enabled": True,
        },
        DeploymentPhase.PRODUCTION: {
            "phase": DeploymentPhase.PRODUCTION,
            "agents_enabled": {
                "profile_agent": True,
                "career_agent": True,
                "gap_agent": True,
                "roadmap_agent": True,
            },
            "monitoring_enabled": True,
            "health_check_enabled": True,
            "error_rate_threshold": 0.01,  # 1% - strict threshold
            "latency_threshold_seconds": 10.0,
            "canary_rollout_percentage": float(os.getenv("CANARY_ROLLOUT", "0.0")),
            "auto_rollback_enabled": True,
        },
    }
    
    config_dict = configs.get(phase)
    if not config_dict:
        raise ValueError(f"No config for phase: {phase}")
    
    return DeploymentConfig(**config_dict)


def is_agent_enabled(agent_name: str) -> bool:
    """Check if specific agent is enabled"""
    config = get_config()
    return config.agents_enabled.get(agent_name, False)


def should_enable_monitoring() -> bool:
    """Check if monitoring should be enabled"""
    config = get_config()
    return config.monitoring_enabled


def get_error_rate_threshold() -> float:
    """Get error rate threshold for current phase"""
    config = get_config()
    return config.error_rate_threshold


def get_latency_threshold() -> float:
    """Get latency threshold for current phase"""
    config = get_config()
    return config.latency_threshold_seconds


def is_pilot_user(user_id: str) -> bool:
    """Check if user is in pilot program"""
    phase = get_phase()
    if phase != DeploymentPhase.PILOT:
        return False
    
    config = get_config()
    return user_id in (config.pilot_user_ids or [])


def get_canary_rollout_percentage() -> float:
    """Get canary rollout percentage (0.0 = all users, 0.05 = 5%)"""
    phase = get_phase()
    if phase != DeploymentPhase.PRODUCTION:
        return 0.0
    
    config = get_config()
    return config.canary_rollout_percentage


def should_use_canary_version(user_id: str) -> bool:
    """Determine if user should receive canary agent version"""
    import random
    
    canary_pct = get_canary_rollout_percentage()
    if canary_pct == 0.0:
        return False
    
    # Hash user_id to get consistent canary assignment
    user_hash = hash(user_id) % 100
    return (user_hash / 100.0) < canary_pct
