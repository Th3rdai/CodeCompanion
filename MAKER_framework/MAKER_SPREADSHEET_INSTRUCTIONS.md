# MAKER Spreadsheet Setup Instructions

## Files Created

I've created 8 CSV files that form the complete MAKER framework tracking system:

1. `01_Project_Dashboard.csv` - Executive KPI overview
2. `02_Task_Decomposition.csv` - Task breakdown tracking
3. `03_Agent_Registry.csv` - Agent performance monitoring  
4. `04_Voting_Results.csv` - Consensus tracking
5. `05_Red_Flag_Monitoring.csv` - Error detection metrics
6. `06_Execution_Log.csv` - Detailed execution history
7. `07_Performance_Metrics.csv` - Daily performance tracking
8. `08_Development_Timeline.csv` - Project milestone tracking

## Setup Instructions

### Option 1: Google Sheets (Recommended)
1. Open Google Sheets (sheets.google.com)
2. Create a new spreadsheet named "MAKER Framework Tracker"
3. Import each CSV file as a separate sheet:
   - Click the + tab at bottom
   - Select "Import" from the menu
   - Upload each CSV file
   - Choose "Insert new sheet(s)"
   - Rename sheets to remove the number prefix (e.g., "Project Dashboard")

### Option 2: Microsoft Excel
1. Open Excel
2. Create a new workbook named "MAKER Framework Tracker"
3. For each CSV file:
   - Right-click sheet tab → Insert → Worksheet
   - Go to Data → From Text/CSV
   - Select the CSV file and import
   - Rename the sheet appropriately

### Option 3: LibreOffice Calc
1. Open LibreOffice Calc
2. File → Open → Select first CSV file
3. For additional sheets:
   - Right-click sheet tab → Insert Sheet
   - Copy/paste data from other CSV files

## Essential Formulas to Add

### Project Dashboard (Sheet 1)
Add these formulas in column G (Progress %):
```
Row 2: =B2/C2*100
Row 3: =B3
Row 4: =B4/C4*100
```

Add status color logic in column H:
```
=IF(B2>=C2,"🟢",IF(B2>=C2*0.8,"🟡","🔴"))
```

### Performance Metrics (Sheet 7)
Add these calculated columns:

**Success Rate (Column K):**
```
=C2/B2*100
```

**Daily Growth (Column L):**
```
=B2-B1
```

**Alert Formula (Column I):**
```
=IF(AND(C2/B2>0.95,G2>99),"🟢",IF(AND(C2/B2>0.90,G2>97),"🟡","🔴"))
```

### Voting Results (Sheet 4)
Add consensus strength in column O:
```
=E2/D2*100
```

### Red Flag Monitoring (Sheet 5)
Add effectiveness calculation in column H:
```
=G2/(F2+G2)*100
```

## Data Validation Rules

### Task Decomposition (Sheet 2)
- **Status column (K)**: Dropdown with "Planned,Active,Complete,Blocked"
- **Task Type column (E)**: Dropdown with your agent types
- **Complexity column (G)**: Number between 1-10

### Agent Registry (Sheet 3)
- **Status column (M)**: Dropdown with "Active,Inactive,Testing,Deprecated"
- **Success Rate (F)**: Percentage between 0-100%
- **Confidence (E)**: Number between 0-1

### Voting Results (Sheet 4)
- **Final Status (M)**: Dropdown with "Success,Failed,Timeout,Override"
- **Override Required (L)**: Dropdown with "Y,N"

## Conditional Formatting

### Performance Metrics (Sheet 7)
1. Select Alert Level column (I)
2. Format → Conditional formatting
3. Set rules:
   - Green = Green background
   - Yellow = Yellow background  
   - Red = Red background

### Project Dashboard (Sheet 1)
1. Select Progress % column (G)
2. Apply color scale:
   - 0% = Red
   - 50% = Yellow
   - 100% = Green

### Agent Registry (Sheet 3)
1. Select Success Rate column (F)
2. Apply data bars for visual comparison
3. Select Status column (M) and color code:
   - Active = Green
   - Testing = Yellow
   - Inactive = Red

## Automated Updates

### Daily Routine (5 minutes)
1. **Update Project Dashboard**:
   - Increment Total Tasks Executed (B2)
   - Update current values from system metrics
   - Update Last Updated timestamps (E2:E11)

2. **Add Execution Log entries**:
   - Copy new executions from system logs
   - Calculate running totals

3. **Update Performance Metrics**:
   - Add new daily row with current metrics
   - Formulas will auto-calculate rates and alerts

### Weekly Review (15 minutes)
1. **Review Red Flag effectiveness**:
   - Update trigger counts
   - Adjust rules with low effectiveness
   - Add new patterns discovered

2. **Update Agent Registry**:
   - Refresh performance statistics
   - Update versions and status
   - Review resource usage

3. **Timeline Progress**:
   - Update completion percentages
   - Adjust target dates if needed
   - Add new milestones

## Integration with Development Framework

### Code Integration Points
Link spreadsheet updates to your MAKER system:

```python
# Example: Auto-update spreadsheet from Python
import pandas as pd
from datetime import datetime

def log_execution(exec_id, task_type, success, confidence, exec_time):
    """Add execution to log"""
    new_row = {
        'Timestamp': datetime.now(),
        'Execution ID': exec_id,
        'Task Type': task_type,
        'Success': 'Y' if success else 'N',
        'Confidence Score': confidence,
        'Execution Time (ms)': exec_time
    }
    
    # Append to CSV or update Google Sheets via API
    df = pd.read_csv('06_Execution_Log.csv')
    df = df.append(new_row, ignore_index=True)
    df.to_csv('06_Execution_Log.csv', index=False)

def update_agent_stats(agent_type, new_execution_time, success):
    """Update agent performance statistics"""
    df = pd.read_csv('03_Agent_Registry.csv')
    
    # Find agent row and update stats
    mask = df['Agent Type'] == agent_type
    if mask.any():
        df.loc[mask, 'Total Executions'] += 1
        # Update running averages
        # ... calculation logic
    
    df.to_csv('03_Agent_Registry.csv', index=False)
```

### Dashboard Alerts
Set up automated alerts based on spreadsheet data:

```python
def check_system_health():
    """Monitor key metrics and send alerts"""
    dashboard = pd.read_csv('01_Project_Dashboard.csv')
    
    # Check for red status items
    red_items = dashboard[dashboard['Status'] == 'Red']
    if not red_items.empty:
        send_alert(f"Red status items: {red_items['Metric Name'].tolist()}")
    
    # Check recent performance
    metrics = pd.read_csv('07_Performance_Metrics.csv')
    latest = metrics.iloc[-1]
    
    if latest['Alert Level'] == 'Red':
        send_alert(f"Performance alert: {latest['Action Items']}")
```

## Best Practices

### Data Entry
- Use consistent formats (dates, percentages, etc.)
- Update timestamps when making changes
- Add notes for unusual values or decisions
- Validate data before saving

### Analysis
- Review trends weekly, not just current values
- Compare performance across different agent types
- Look for patterns in red flag triggers
- Track improvement over time

### Maintenance
- Archive old execution logs monthly
- Update formulas when adding new columns
- Backup spreadsheet weekly
- Review and update validation rules quarterly

## Sample Queries for Analysis

### Finding Performance Issues
```sql
-- In Google Sheets, use QUERY function:
=QUERY(A:N,"SELECT A,F,G WHERE F < 95 ORDER BY G DESC",1)
```

### Top Performing Agents
```sql
=QUERY(A:N,"SELECT A,E,F WHERE M='Active' ORDER BY F DESC LIMIT 5",1)
```

### Recent Red Flags
```sql
=QUERY(A:L,"SELECT A,B,E WHERE I >= date '2024-11-20' ORDER BY I DESC",1)
```

This spreadsheet system provides comprehensive tracking and analysis capabilities for your MAKER framework implementation. Start with basic data entry and gradually implement the advanced formulas and automations as your system grows.