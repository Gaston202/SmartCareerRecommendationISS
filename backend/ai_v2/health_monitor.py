"""
Agent Health Monitoring & Automatic Remediation
Tracks agent health metrics and triggers rollbacks if thresholds exceeded
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from collections import deque

logger = logging.getLogger(__name__)


@dataclass
class AgentMetrics:
    """Metrics for a single agent"""
    agent_name: str
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    latencies: deque = field(default_factory=lambda: deque(maxlen=100))  # Last 100 calls
    last_error: Optional[str] = None
    last_error_time: Optional[datetime] = None
    
    @property
    def error_rate(self) -> float:
        """Calculate error rate (0.0 - 1.0)"""
        if self.total_calls == 0:
            return 0.0
        return self.failed_calls / self.total_calls
    
    @property
    def avg_latency(self) -> float:
        """Calculate average latency in seconds"""
        if not self.latencies:
            return 0.0
        return sum(self.latencies) / len(self.latencies)
    
    @property
    def p95_latency(self) -> float:
        """Calculate p95 latency"""
        if not self.latencies or len(self.latencies) < 20:
            return 0.0
        sorted_latencies = sorted(self.latencies)
        idx = int(len(sorted_latencies) * 0.95)
        return sorted_latencies[idx]
    
    @property
    def p99_latency(self) -> float:
        """Calculate p99 latency"""
        if not self.latencies or len(self.latencies) < 100:
            return 0.0
        sorted_latencies = sorted(self.latencies)
        idx = int(len(sorted_latencies) * 0.99)
        return sorted_latencies[idx]
    
    def reset(self):
        """Reset metrics"""
        self.total_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0
        self.latencies.clear()


@dataclass
class HealthCheckResult:
    """Result of a health check"""
    agent_name: str
    is_healthy: bool
    error_rate: float
    avg_latency: float
    p99_latency: float
    issues: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


class AgentHealthMonitor:
    """Monitors agent health and triggers remediation"""
    
    def __init__(self):
        self.metrics: Dict[str, AgentMetrics] = {}
        self.disabled_agents: Dict[str, datetime] = {}  # agent_name -> disabled_at
        self.remediation_history: List[dict] = []
    
    def record_call(self, agent_name: str, success: bool, latency_seconds: float, error: Optional[str] = None):
        """Record an agent call"""
        if agent_name not in self.metrics:
            self.metrics[agent_name] = AgentMetrics(agent_name)
        
        m = self.metrics[agent_name]
        m.total_calls += 1
        
        if success:
            m.successful_calls += 1
        else:
            m.failed_calls += 1
            m.last_error = error
            m.last_error_time = datetime.now()
        
        m.latencies.append(latency_seconds)
    
    def get_metrics(self, agent_name: str) -> Optional[AgentMetrics]:
        """Get metrics for an agent"""
        return self.metrics.get(agent_name)
    
    def check_agent_health(self, agent_name: str, 
                          error_threshold: float = 0.05,
                          latency_threshold: float = 15.0) -> HealthCheckResult:
        """Check if agent is healthy"""
        metrics = self.metrics.get(agent_name)
        
        if not metrics or metrics.total_calls < 10:
            # Not enough data
            return HealthCheckResult(
                agent_name=agent_name,
                is_healthy=True,
                error_rate=0.0,
                avg_latency=0.0,
                p99_latency=0.0,
                issues=["Insufficient data for health check"]
            )
        
        issues = []
        recommendations = []
        
        # Check error rate
        if metrics.error_rate > error_threshold:
            issues.append(f"High error rate: {metrics.error_rate:.1%} (threshold: {error_threshold:.1%})")
            recommendations.append("Check LLM API status and logs")
        
        # Check latency
        if metrics.avg_latency > latency_threshold:
            issues.append(f"High avg latency: {metrics.avg_latency:.1f}s (threshold: {latency_threshold}s)")
            recommendations.append("Increase timeout or optimize prompts")
        
        if metrics.p99_latency > latency_threshold * 1.5:
            issues.append(f"High p99 latency: {metrics.p99_latency:.1f}s")
            recommendations.append("Consider circuit breaker for slow requests")
        
        is_healthy = len(issues) == 0
        
        return HealthCheckResult(
            agent_name=agent_name,
            is_healthy=is_healthy,
            error_rate=metrics.error_rate,
            avg_latency=metrics.avg_latency,
            p99_latency=metrics.p99_latency,
            issues=issues,
            recommendations=recommendations
        )
    
    def disable_agent(self, agent_name: str, reason: str):
        """Disable agent (automatic remediation)"""
        self.disabled_agents[agent_name] = datetime.now()
        self.remediation_history.append({
            'timestamp': datetime.now().isoformat(),
            'agent': agent_name,
            'action': 'disable',
            'reason': reason
        })
        logger.error(f"Agent {agent_name} disabled: {reason}")
    
    def enable_agent(self, agent_name: str):
        """Re-enable agent"""
        if agent_name in self.disabled_agents:
            del self.disabled_agents[agent_name]
        self.remediation_history.append({
            'timestamp': datetime.now().isoformat(),
            'agent': agent_name,
            'action': 'enable',
            'reason': 'Manual re-enable'
        })
        logger.info(f"Agent {agent_name} re-enabled")
    
    def is_agent_disabled(self, agent_name: str) -> bool:
        """Check if agent is disabled"""
        return agent_name in self.disabled_agents
    
    def get_status_report(self) -> dict:
        """Get overall health status"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'agents': {},
            'disabled_agents': list(self.disabled_agents.keys()),
            'recent_remediation': self.remediation_history[-10:]  # Last 10 actions
        }
        
        for agent_name, metrics in self.metrics.items():
            report['agents'][agent_name] = {
                'total_calls': metrics.total_calls,
                'success_rate': (metrics.successful_calls / metrics.total_calls * 100) if metrics.total_calls > 0 else 0,
                'error_rate': metrics.error_rate,
                'avg_latency_s': metrics.avg_latency,
                'p99_latency_s': metrics.p99_latency,
                'is_disabled': self.is_agent_disabled(agent_name),
                'last_error': metrics.last_error,
                'last_error_time': metrics.last_error_time.isoformat() if metrics.last_error_time else None
            }
        
        return report


# Global health monitor instance
_health_monitor: Optional[AgentHealthMonitor] = None


def get_health_monitor() -> AgentHealthMonitor:
    """Get or create the global health monitor"""
    global _health_monitor
    if _health_monitor is None:
        _health_monitor = AgentHealthMonitor()
    return _health_monitor


def record_agent_call(agent_name: str, success: bool, latency_seconds: float, error: Optional[str] = None):
    """Record an agent call for monitoring"""
    monitor = get_health_monitor()
    monitor.record_call(agent_name, success, latency_seconds, error)


def check_all_agents_health(error_threshold: float = 0.05, latency_threshold: float = 15.0) -> Dict[str, HealthCheckResult]:
    """Check health of all agents"""
    monitor = get_health_monitor()
    results = {}
    
    for agent_name in monitor.metrics.keys():
        results[agent_name] = monitor.check_agent_health(agent_name, error_threshold, latency_threshold)
    
    return results


def auto_remediate(error_threshold: float = 0.05, latency_threshold: float = 15.0):
    """Automatically remediate unhealthy agents"""
    from deployment_config import get_config
    
    config = get_config()
    if not config.auto_rollback_enabled:
        return
    
    monitor = get_health_monitor()
    results = check_all_agents_health(error_threshold, latency_threshold)
    
    for agent_name, result in results.items():
        if not result.is_healthy:
            reason = "; ".join(result.issues)
            logger.warning(f"Auto-remediating {agent_name}: {reason}")
            monitor.disable_agent(agent_name, reason)


def get_agent_status(agent_name: str) -> dict:
    """Get status for a specific agent"""
    monitor = get_health_monitor()
    metrics = monitor.get_metrics(agent_name)
    
    if not metrics:
        return {'status': 'unknown', 'total_calls': 0}
    
    return {
        'status': 'disabled' if monitor.is_agent_disabled(agent_name) else 'active',
        'total_calls': metrics.total_calls,
        'success_rate': (metrics.successful_calls / metrics.total_calls * 100) if metrics.total_calls > 0 else 0,
        'error_rate': metrics.error_rate,
        'avg_latency_s': metrics.avg_latency,
        'p99_latency_s': metrics.p99_latency,
    }
