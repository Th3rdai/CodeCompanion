# GitHub Copilot Instructions for MAKER Framework

## Project Overview
This repository implements the MAKER framework (Maximal Agentic decomposition, first-to-ahead-by-K Error correction, and Red-flagging) - a system for executing million-step LLM tasks with zero errors through Massively Decomposed Agentic Processes (MDAPs).

## Core Architecture Patterns

### MicroAgent Base Class Pattern
```python
from abc import ABC, abstractmethod
from typing import Any, Dict
from pydantic import BaseModel
import asyncio

class TaskResult(BaseModel):
    success: bool
    output: Any
    confidence: float
    execution_time: float
    error_message: Optional[str] = None

class MicroAgent(ABC):
    def __init__(self, agent_id: str, task_type: str):
        self.agent_id = agent_id
        self.task_type = task_type
        self.logger = logging.getLogger(f"agent.{agent_id}")
    
    @abstractmethod
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        """Execute the specific subtask this agent handles"""
        pass
    
    @abstractmethod
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        """Validate input data for this agent"""
        pass
```

### Agent Implementation Guidelines
When implementing new agents, follow these patterns:

#### Mathematical Agents
```python
class ArithmeticAgent(MicroAgent):
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        try:
            # Always include proper error handling
            result = self._perform_calculation(input_data)
            return TaskResult(
                success=True,
                output=result,
                confidence=0.99,  # High confidence for deterministic operations
                execution_time=self._calculate_execution_time()
            )
        except Exception as e:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=self._calculate_execution_time(),
                error_message=str(e)
            )
```

#### LLM-Based Agents
```python
class LLMAgent(MicroAgent):
    def __init__(self, agent_id: str, task_type: str, model: str = "gpt-4o-mini"):
        super().__init__(agent_id, task_type)
        self.model = model  # Use smaller models for better cost-effectiveness
        
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        # Always use low temperature for consistency
        # Include timeout protection
        # Calculate confidence based on response characteristics
        pass
```

### Voting System Pattern
```python
class VotingSystem:
    def __init__(self, min_agents: int = 3, confidence_threshold: float = 0.7):
        # Always use odd numbers to avoid ties
        self.min_agents = min_agents
        self.confidence_threshold = confidence_threshold
    
    def majority_vote(self, results: List[TaskResult]) -> TaskResult:
        # Weight votes by confidence scores
        # Require consensus above threshold
        # Handle tie-breaking scenarios
        pass
```

### Red Flag Rules Pattern
```python
# Always implement these critical red flag rules:
critical_rules = [
    RedFlagRule(
        name="Error Keywords",
        pattern=r"(error|failed|exception|null|undefined)",
        severity="high",
        action="block"
    ),
    RedFlagRule(
        name="Infinite Values", 
        pattern=r"(inf|nan|-?\d{10,})",
        severity="critical",
        action="block"
    ),
    RedFlagRule(
        name="Empty Results",
        pattern=r"^$|null|undefined",
        severity="high",
        action="block"
    )
]
```

## Code Completion Guidelines

### Function Naming Conventions
- Agent classes: `{Purpose}Agent` (e.g., `AdditionAgent`, `ValidationAgent`)
- Async methods: Use `async/await` for all agent operations
- Result handling: Always return `TaskResult` objects with proper error handling

### Performance Requirements
- Success rate > 95% for production agents
- Average confidence > 0.8
- Execution time < 2000ms (except LLM agents)
- Proper timeout protection (30s default)

### Error Handling Patterns
```python
# Always wrap agent execution in try-catch
try:
    result = await agent.process_with_timeout(input_data, timeout=30)
    if not result.success:
        # Handle agent failure
        pass
except asyncio.TimeoutError:
    # Handle timeout
    pass
except Exception as e:
    # Handle unexpected errors
    pass
```

### Testing Patterns
```python
# Unit test pattern for agents
async def test_agent_success_case():
    agent = SomeAgent("test_id", "test_type")
    input_data = {"valid": "input"}
    result = await agent.execute(input_data)
    
    assert result.success == True
    assert result.confidence > 0.7
    assert result.output is not None

async def test_agent_voting():
    agents = [Agent(f"agent_{i}", "test") for i in range(3)]
    voting_system = VotingSystem()
    # Test consensus scenarios
```

### Deployment Patterns
```python
# Production service pattern
from fastapi import FastAPI
from prometheus_client import Counter, Histogram

app = FastAPI()
task_counter = Counter('maker_tasks_total', 'Total tasks', ['status'])
execution_time = Histogram('maker_execution_seconds', 'Execution time')

@app.post("/execute")
async def execute_task(task: Dict[str, Any]):
    # Always include metrics and monitoring
    with execution_time.time():
        result = await maker_engine.execute_task(task)
        task_counter.labels(status='success' if result.success else 'failure').inc()
        return result
```

## Common Code Completions

### When creating new agents:
```python
class NewAgent(MicroAgent):
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        start_time = asyncio.get_event_loop().time()
        try:
            # Validate input
            if not self.validate_input(input_data):
                raise ValueError("Invalid input data")
            
            # Perform operation
            result = self._perform_operation(input_data)
            
            execution_time = asyncio.get_event_loop().time() - start_time
            return TaskResult(
                success=True,
                output=result,
                confidence=self._calculate_confidence(result),
                execution_time=execution_time * 1000  # Convert to ms
            )
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=execution_time * 1000,
                error_message=str(e)
            )
    
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        # Implement specific validation logic
        return True  # Replace with actual validation
```

### When adding task decomposition:
```python
def decompose_task(self, main_task: Dict[str, Any]) -> List[SubTask]:
    subtasks = []
    
    # Break down to finest reasonable granularity
    # Ensure each subtask can be validated independently
    # Check for circular dependencies
    
    return subtasks
```

### When implementing red flag checking:
```python
def check_red_flags(self, result: TaskResult) -> List[str]:
    flags = []
    output_str = str(result.output)
    
    # Check against all registered rules
    for rule in self.red_flag_rules:
        if re.search(rule.pattern, output_str, re.IGNORECASE):
            flags.append(f"{rule.name}: {rule.severity}")
    
    return flags
```

## Integration Points

### Spreadsheet Metrics Integration
```python
def update_execution_metrics(execution_id: str, result: TaskResult):
    # Update 06_Execution_Log.csv
    # Update agent performance in 03_Agent_Registry.csv
    # Update voting results in 04_Voting_Results.csv
    pass
```

### Docker Configuration
```yaml
# docker-compose.yml pattern
services:
  maker-service:
    build: .
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
      - postgres
```

## Quality Standards
- All async operations must have timeout protection
- Agents must validate inputs and handle all error cases
- Voting requires odd numbers of agents (3, 5, 7)
- Confidence scores must be calculated consistently
- Red flag rules must be comprehensive and tuned
- Performance metrics must be tracked for all operations

## References
- Full implementation: `MAKER_DEVELOPMENT_FRAMEWORK.md`
- Tracking system: `MAKER_SPREADSHEET_PROCESS.md`
- Research context: `SUMMARY.md`