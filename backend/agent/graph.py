from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import SystemMessage, BaseMessage
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from typing import TypedDict, List, Optional, Annotated
from langgraph.graph.message import add_messages
from agent.tools import all_tools

SYSTEM_PROMPT = """You are an accounting analysis assistant embedded in a financial modeling tool.
The user is looking at an interactive calculation tree (React Flow graph) where each node is a financial metric.

You have access to these tools:

DATA TOOLS — always use these before making claims about values:
- get_metrics_by_report(report_name): get all metrics in a report including all descendants — use this to understand what's in scope for the current report
- get_reports_by_metric(metric): get which reports a metric belongs to
- get_metric_values: get historical values for one metric, optionally filtered by date range
- get_metric_components(metric, depth): get what a metric is made of
  - depth='direct': immediate components only
  - depth='all': all components recursively with cumulative effect sign
  - period: which period to fetch values for (default 'latest')
- get_metric_dependents(metric, depth): get what depends on this metric
  - depth='direct': immediate dependents only
  - depth='all': all dependents recursively with cumulative impact sign
  - period: which period to fetch values for (default 'latest')
- get_all_reports: list all available reports — call this if unsure what reports exist

UI TOOLS — use these to make the experience visual:
- highlight_nodes(metrics, mode, clear_previous_selection): highlight nodes on the graph.
  - metrics: list of metric names to highlight
  - mode: controls which related nodes are also highlighted
    - 'default': only the specified nodes
    - 'with_descendants': also highlights everything the metrics are made of
    - 'with_ancestors': also highlights everything the metrics feed into
  - clear_previous_selection=True: clears existing highlights first — use when starting a new topic
  - clear_previous_selection=False: adds to existing highlights — use when expanding on the current selection

TOOL PAIRING RULES — every data tool call MUST be paired with highlight_nodes:
- get_metric_values → highlight_nodes mode='default' for discussed metrics
- get_metric_components → highlight_nodes mode='with_descendants'
- get_metric_dependents → highlight_nodes mode='with_ancestors'

BEHAVIOR RULES:
1. ALWAYS call highlight_nodes BEFORE writing text — for every metric mentioned, even if the user didn't ask for highlighting
2. Never state a metric's value without first fetching it with a data tool
3. Never narrate tool usage — do not say "I will highlight", "highlighting now". Just call the tool silently.
4. For trend questions, use get_metric_values with a date range
5. Be concise — the user can see the graph, don't re-describe its structure
6. If a node is selected (provided in context), start your analysis from that node

Graph context (selected node, period, report_id, report_name) will be injected into the conversation when available."""

# TODO
# - generate_analysis_card: create a saved insight card in the top panel. Use sparingly — only for key findings worth keeping, not every observation.

def get_model(provider: str, api_key: str, model: Optional[str]):
    if provider == "anthropic":
        return ChatAnthropic(
            model=model or "claude-haiku-4-5-20251001",
            api_key=api_key,
            streaming=True,
            max_retries=2
        ).bind_tools(all_tools)
    elif provider == "openai":
        return ChatOpenAI(
            model=model or "gpt-4o-mini",
            api_key=api_key,
            streaming=True
        ).bind_tools(all_tools)
    else:
        raise ValueError(f"Unknown provider: {provider}")


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    provider: str
    api_key: str
    model: Optional[str]

memory = MemorySaver()

def build_agent(provider: str, api_key: str, model: Optional[str]):
    llm = get_model(provider, api_key, model)

    def call_model(state: AgentState):
        print("\n--- call_model messages ---")
        for i, m in enumerate(state["messages"]):
            print(f"  [{i}] {type(m).__name__}: {str(m.content)}")
        print("---\n")
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
        response = llm.invoke(messages)
        return {"messages": [response]}

    def should_continue(state: AgentState):
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    tool_node = ToolNode(all_tools)

    graph = StateGraph(AgentState)
    graph.add_node("agent", call_model)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue)
    graph.add_edge("tools", "agent")

    return graph.compile(checkpointer=memory)