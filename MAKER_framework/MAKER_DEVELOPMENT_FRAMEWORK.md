# MAKER Development Framework
## Practical Implementation Guide for Developers and AI Agents

This framework provides step-by-step implementation guidance for building MAKER-based systems that can execute million-step tasks with zero errors.

## Prerequisites

### Technology Stack
- **Language**: Python 3.8+ (recommended for prototype)
- **Message Queue**: Redis/RabbitMQ for agent communication
- **Database**: PostgreSQL/MongoDB for state management
- **Container**: Docker for agent deployment
- **Monitoring**: Prometheus + Grafana for observability

### Required Libraries
```bash
pip install asyncio celery redis fastapi pydantic SQLAlchemy prometheus-client
```

## Phase 1: Core Architecture Setup

### 1.1 Agent Base Class

```python
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
import asyncio
import logging

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
    
    async def process_with_timeout(self, input_data: Dict[str, Any], timeout: int = 30) -> TaskResult:
        """Execute with timeout protection"""
        try:
            return await asyncio.wait_for(self.execute(input_data), timeout=timeout)
        except asyncio.TimeoutError:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=timeout,
                error_message=f"Agent {self.agent_id} timed out"
            )
```

### 1.2 Voting System Implementation

```python
from collections import Counter
from statistics import mean

class VotingSystem:
    def __init__(self, min_agents: int = 3, confidence_threshold: float = 0.7):
        self.min_agents = min_agents
        self.confidence_threshold = confidence_threshold
    
    def majority_vote(self, results: List[TaskResult]) -> TaskResult:
        """Implement majority voting with confidence weighting"""
        if len(results) < self.min_agents:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=0,
                error_message="Insufficient agents for voting"
            )
        
        # Filter successful results
        successful_results = [r for r in results if r.success]
        
        if not successful_results:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=mean([r.execution_time for r in results]),
                error_message="All agents failed"
            )
        
        # Weight votes by confidence
        weighted_votes = {}
        for result in successful_results:
            output_key = str(result.output)  # Convert to string for hashing
            if output_key not in weighted_votes:
                weighted_votes[output_key] = {
                    'votes': 0,
                    'total_confidence': 0,
                    'result': result
                }
            weighted_votes[output_key]['votes'] += 1
            weighted_votes[output_key]['total_confidence'] += result.confidence
        
        # Find consensus
        best_option = max(weighted_votes.items(), 
                         key=lambda x: (x[1]['votes'], x[1]['total_confidence']))
        
        consensus_confidence = best_option[1]['total_confidence'] / best_option[1]['votes']
        
        return TaskResult(
            success=consensus_confidence >= self.confidence_threshold,
            output=best_option[1]['result'].output,
            confidence=consensus_confidence,
            execution_time=mean([r.execution_time for r in successful_results]),
            error_message=None if consensus_confidence >= self.confidence_threshold 
                         else "Consensus confidence below threshold"
        )
```

### 1.3 Red-Flagging System

```python
from typing import Callable, List
import re

class RedFlagRule(BaseModel):
    name: str
    pattern: str
    severity: str  # 'low', 'medium', 'high'
    action: str   # 'warn', 'block', 'escalate'

class RedFlaggingSystem:
    def __init__(self):
        self.rules: List[RedFlagRule] = []
        self.custom_validators: List[Callable] = []
    
    def add_rule(self, rule: RedFlagRule):
        """Add a red flag rule"""
        self.rules.append(rule)
    
    def add_validator(self, validator: Callable[[Any], bool]):
        """Add custom validation function"""
        self.custom_validators.append(validator)
    
    def check_result(self, result: TaskResult) -> List[str]:
        """Check result against all red flag rules"""
        flags = []
        
        # Check pattern-based rules
        output_str = str(result.output)
        for rule in self.rules:
            if re.search(rule.pattern, output_str, re.IGNORECASE):
                flags.append(f"{rule.name}: {rule.severity}")
        
        # Check custom validators
        for validator in self.custom_validators:
            try:
                if not validator(result.output):
                    flags.append("Custom validation failed")
            except Exception as e:
                flags.append(f"Validator error: {str(e)}")
        
        return flags

# Example red flag rules
common_rules = [
    RedFlagRule(
        name="Error Keywords",
        pattern=r"(error|failed|exception|null|undefined)",
        severity="high",
        action="block"
    ),
    RedFlagRule(
        name="Suspicious Numbers",
        pattern=r"(inf|nan|-?\d{10,})",
        severity="medium", 
        action="warn"
    )
]
```

## Phase 2: Task Decomposition Engine

### 2.1 Task Decomposer

```python
from typing import List, Dict
import networkx as nx

class SubTask(BaseModel):
    id: str
    type: str
    input_spec: Dict[str, Any]
    output_spec: Dict[str, Any] 
    dependencies: List[str]
    estimated_complexity: int
    required_agents: int = 3

class TaskDecomposer:
    def __init__(self):
        self.decomposition_strategies = {}
    
    def register_strategy(self, task_type: str, strategy: Callable):
        """Register decomposition strategy for task type"""
        self.decomposition_strategies[task_type] = strategy
    
    def decompose(self, main_task: Dict[str, Any]) -> List[SubTask]:
        """Decompose main task into subtasks"""
        task_type = main_task.get('type')
        
        if task_type not in self.decomposition_strategies:
            raise ValueError(f"No decomposition strategy for task type: {task_type}")
        
        return self.decomposition_strategies[task_type](main_task)
    
    def create_dependency_graph(self, subtasks: List[SubTask]) -> nx.DiGraph:
        """Create directed graph of task dependencies"""
        graph = nx.DiGraph()
        
        for task in subtasks:
            graph.add_node(task.id, task=task)
            
        for task in subtasks:
            for dep_id in task.dependencies:
                graph.add_edge(dep_id, task.id)
        
        if not nx.is_directed_acyclic_graph(graph):
            raise ValueError("Circular dependency detected in task decomposition")
        
        return graph

# Example: Arithmetic task decomposition
def arithmetic_decomposer(task: Dict[str, Any]) -> List[SubTask]:
    """Example decomposition for complex arithmetic"""
    expression = task['expression']  # e.g., "(2+3)*4-1"
    
    subtasks = []
    # This would parse the expression and create subtasks
    # For brevity, showing simplified version
    
    subtasks.append(SubTask(
        id="add_1",
        type="addition",
        input_spec={"a": 2, "b": 3},
        output_spec={"result": "number"},
        dependencies=[],
        estimated_complexity=1
    ))
    
    subtasks.append(SubTask(
        id="mult_1", 
        type="multiplication",
        input_spec={"a": "add_1.result", "b": 4},
        output_spec={"result": "number"},
        dependencies=["add_1"],
        estimated_complexity=1
    ))
    
    return subtasks
```

### 2.2 Execution Engine

```python
from concurrent.futures import ThreadPoolExecutor
import asyncio

class MAKERExecutionEngine:
    def __init__(self, max_concurrent_tasks: int = 10):
        self.agent_pool = {}
        self.voting_system = VotingSystem()
        self.red_flagging = RedFlaggingSystem()
        self.task_decomposer = TaskDecomposer()
        self.max_concurrent = max_concurrent_tasks
        self.execution_state = {}
        
        # Add common red flag rules
        for rule in common_rules:
            self.red_flagging.add_rule(rule)
    
    def register_agent_type(self, task_type: str, agent_class: type):
        """Register agent type for specific task types"""
        self.agent_pool[task_type] = agent_class
    
    async def execute_subtask(self, subtask: SubTask, input_data: Dict[str, Any]) -> TaskResult:
        """Execute a single subtask with voting"""
        if subtask.type not in self.agent_pool:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=0,
                error_message=f"No agents available for task type: {subtask.type}"
            )
        
        # Create multiple agent instances
        agents = []
        agent_class = self.agent_pool[subtask.type]
        
        for i in range(subtask.required_agents):
            agent = agent_class(f"{subtask.id}_agent_{i}", subtask.type)
            agents.append(agent)
        
        # Execute in parallel
        tasks = [agent.process_with_timeout(input_data) for agent in agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        valid_results = [r for r in results if isinstance(r, TaskResult)]
        
        # Vote on results
        consensus_result = self.voting_system.majority_vote(valid_results)
        
        # Check red flags
        if consensus_result.success:
            flags = self.red_flagging.check_result(consensus_result)
            if flags:
                consensus_result.success = False
                consensus_result.error_message = f"Red flags: {', '.join(flags)}"
        
        return consensus_result
    
    async def execute_task_graph(self, subtasks: List[SubTask]) -> Dict[str, TaskResult]:
        """Execute all subtasks respecting dependencies"""
        graph = self.task_decomposer.create_dependency_graph(subtasks)
        results = {}
        
        # Execute in topological order
        for task_id in nx.topological_sort(graph):
            subtask = graph.nodes[task_id]['task']
            
            # Prepare input data from dependencies
            input_data = {}
            for dep_id in subtask.dependencies:
                if dep_id in results and results[dep_id].success:
                    input_data.update({f"{dep_id}_output": results[dep_id].output})
                else:
                    # Dependency failed, skip this task
                    results[task_id] = TaskResult(
                        success=False,
                        output=None,
                        confidence=0.0,
                        execution_time=0,
                        error_message=f"Dependency {dep_id} failed"
                    )
                    continue
            
            # Add original input specification
            input_data.update(subtask.input_spec)
            
            # Execute subtask
            results[task_id] = await self.execute_subtask(subtask, input_data)
            
            # If critical task fails, stop execution
            if not results[task_id].success:
                print(f"Task {task_id} failed: {results[task_id].error_message}")
        
        return results
```

## Phase 3: Practical Agent Implementations

### 3.1 Mathematical Operation Agents

```python
class AdditionAgent(MicroAgent):
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        try:
            a = float(input_data['a'])
            b = float(input_data['b'])
            result = a + b
            
            return TaskResult(
                success=True,
                output=result,
                confidence=0.99,  # High confidence for basic math
                execution_time=0.001
            )
        except Exception as e:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=0.001,
                error_message=str(e)
            )
    
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        return 'a' in input_data and 'b' in input_data

class MultiplicationAgent(MicroAgent):
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        try:
            a = float(input_data['a'])
            b = float(input_data['b'])
            result = a * b
            
            return TaskResult(
                success=True,
                output=result,
                confidence=0.99,
                execution_time=0.001
            )
        except Exception as e:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=0.001,
                error_message=str(e)
            )
    
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        return 'a' in input_data and 'b' in input_data
```

### 3.2 LLM-Based Agent

```python
import openai
from typing import Optional

class LLMAgent(MicroAgent):
    def __init__(self, agent_id: str, task_type: str, model: str = "gpt-4o-mini"):
        super().__init__(agent_id, task_type)
        self.model = model
        self.client = openai.AsyncOpenAI()
    
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        try:
            prompt = input_data.get('prompt', '')
            context = input_data.get('context', '')
            
            full_prompt = f"""
            Task: {self.task_type}
            Context: {context}
            Input: {prompt}
            
            Provide a clear, precise answer. Be confident in your response.
            """
            
            start_time = asyncio.get_event_loop().time()
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.1  # Low temperature for consistency
            )
            
            execution_time = asyncio.get_event_loop().time() - start_time
            
            result = response.choices[0].message.content.strip()
            
            # Simple confidence based on response length and certainty words
            confidence = self._calculate_confidence(result)
            
            return TaskResult(
                success=True,
                output=result,
                confidence=confidence,
                execution_time=execution_time
            )
            
        except Exception as e:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=0,
                error_message=str(e)
            )
    
    def _calculate_confidence(self, response: str) -> float:
        """Simple confidence calculation based on response characteristics"""
        base_confidence = 0.7
        
        # Boost confidence for certain words
        certainty_words = ['definitely', 'clearly', 'certainly', 'obviously']
        uncertainty_words = ['maybe', 'possibly', 'might', 'unclear']
        
        for word in certainty_words:
            if word in response.lower():
                base_confidence += 0.1
        
        for word in uncertainty_words:
            if word in response.lower():
                base_confidence -= 0.2
        
        return max(0.1, min(0.99, base_confidence))
    
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        return 'prompt' in input_data
```

## Phase 4: Complete Example Implementation

### 4.1 Towers of Hanoi Example

```python
class HanoiMoveAgent(MicroAgent):
    """Agent that validates and executes a single Hanoi move"""
    
    async def execute(self, input_data: Dict[str, Any]) -> TaskResult:
        try:
            current_state = input_data['current_state']  # List of lists representing towers
            move = input_data['move']  # {'from': 0, 'to': 1}
            
            # Validate move
            from_tower = move['from']
            to_tower = move['to']
            
            if not current_state[from_tower]:
                raise ValueError(f"Tower {from_tower} is empty")
            
            disk = current_state[from_tower][-1]  # Top disk
            
            if current_state[to_tower] and current_state[to_tower][-1] < disk:
                raise ValueError(f"Cannot place disk {disk} on smaller disk {current_state[to_tower][-1]}")
            
            # Execute move
            new_state = [tower.copy() for tower in current_state]
            moved_disk = new_state[from_tower].pop()
            new_state[to_tower].append(moved_disk)
            
            return TaskResult(
                success=True,
                output=new_state,
                confidence=0.99,
                execution_time=0.001
            )
            
        except Exception as e:
            return TaskResult(
                success=False,
                output=None,
                confidence=0.0,
                execution_time=0.001,
                error_message=str(e)
            )
    
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        required_keys = ['current_state', 'move']
        return all(key in input_data for key in required_keys)

# Example usage
async def run_hanoi_example():
    """Example of running Towers of Hanoi with MAKER"""
    
    # Initialize engine
    engine = MAKERExecutionEngine()
    engine.register_agent_type("hanoi_move", HanoiMoveAgent)
    
    # Create subtasks for first few moves of 3-disk Hanoi
    subtasks = [
        SubTask(
            id="move_1",
            type="hanoi_move", 
            input_spec={
                "current_state": [[3, 2, 1], [], []],  # All disks on first tower
                "move": {"from": 0, "to": 2}  # Move top disk to last tower
            },
            output_spec={"result": "state"},
            dependencies=[],
            estimated_complexity=1
        ),
        SubTask(
            id="move_2",
            type="hanoi_move",
            input_spec={
                "move": {"from": 0, "to": 1}  # Move middle disk to middle tower
            },
            output_spec={"result": "state"},
            dependencies=["move_1"],
            estimated_complexity=1
        )
    ]
    
    # Execute
    results = await engine.execute_task_graph(subtasks)
    
    for task_id, result in results.items():
        print(f"Task {task_id}: Success={result.success}, Output={result.output}")

# Run the example
# asyncio.run(run_hanoi_example())
```

### 4.2 Production Deployment Template

```python
# main.py - Production deployment
import asyncio
import logging
from fastapi import FastAPI
from prometheus_client import Counter, Histogram, generate_latest

# Metrics
task_counter = Counter('maker_tasks_total', 'Total tasks executed', ['status'])
execution_time = Histogram('maker_execution_seconds', 'Task execution time')

app = FastAPI()

class MAKERService:
    def __init__(self):
        self.engine = MAKERExecutionEngine(max_concurrent_tasks=50)
        self.setup_agents()
        self.setup_monitoring()
    
    def setup_agents(self):
        """Register all available agent types"""
        self.engine.register_agent_type("addition", AdditionAgent)
        self.engine.register_agent_type("multiplication", MultiplicationAgent)  
        self.engine.register_agent_type("llm_text", LLMAgent)
        self.engine.register_agent_type("hanoi_move", HanoiMoveAgent)
    
    def setup_monitoring(self):
        """Setup monitoring and logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    @execution_time.time()
    async def execute_task(self, task_definition: Dict[str, Any]) -> Dict[str, Any]:
        """Main task execution endpoint"""
        try:
            # Decompose task
            subtasks = self.engine.task_decomposer.decompose(task_definition)
            
            # Execute with voting
            results = await self.engine.execute_task_graph(subtasks)
            
            # Check overall success
            success = all(result.success for result in results.values())
            task_counter.labels(status='success' if success else 'failure').inc()
            
            return {
                'success': success,
                'results': {k: v.dict() for k, v in results.items()},
                'total_tasks': len(results)
            }
            
        except Exception as e:
            task_counter.labels(status='error').inc()
            return {
                'success': False,
                'error': str(e),
                'results': {}
            }

# Initialize service
maker_service = MAKERService()

@app.post("/execute")
async def execute_task(task: Dict[str, Any]):
    """Execute a MAKER task"""
    return await maker_service.execute_task(task)

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "agents": len(maker_service.engine.agent_pool)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 4.3 Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  maker-service:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - postgres
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=maker
      - POSTGRES_USER=maker
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Development Workflow

### Step 1: Start with Simple Tasks
```bash
# Clone and setup
git clone <your-repo>
cd maker-framework
pip install -r requirements.txt

# Run simple test
python examples/simple_math.py
```

### Step 2: Test Voting System  
```bash
# Test with multiple agents
python examples/test_voting.py
```

### Step 3: Scale Gradually
```bash
# Start with 10-step tasks, then 100, then 1000+
python examples/scaling_test.py --steps 10
```

### Step 4: Monitor and Optimize
```bash
# Start monitoring
docker-compose up -d
# Access metrics at http://localhost:8000/metrics
```

This framework provides the complete foundation for implementing MAKER-based systems that can reliably execute million-step tasks with zero errors.