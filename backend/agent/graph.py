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
- get_all_metrics: list all available metric names, call this if unsure what exists
- get_data_by_period: get all metric values for a given period (use 'latest' if unspecified)
- get_metric_values: get historical values for one metric, optionally filtered by date range
- get_metric_children: get what a metric is directly made of (one level down)
- get_metric_parents: get which metrics depend on this one
- get_metric_descendants: recursively get everything that makes up a metric
- get_metric_impact: get the full downstream ripple effect of a metric with +/- sign

UI TOOLS — use these to make the experience visual:
- highlight_nodes: highlight nodes on the graph when referring to it. Always do this when discussing a specific metric.

BEHAVIOR RULES:
1. Never state a metric's value without first fetching it with a data tool
2. Always highlight_node when you mention a specific metric by name
3. When the user asks about what drives a metric, use get_metric_descendants
4. When the user asks what a metric affects, use get_metric_impact
5. For trend questions, use get_metric_values with a date range
6. Be concise — the user can see the graph, don't re-describe its structure
7. If a node is selected (provided in context), start your analysis from that node

Graph context (selected node, period) will be injected into the conversation when available."""

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
            print(f"  [{i}] {type(m).__name__}: {str(m.content)[:80]}")
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