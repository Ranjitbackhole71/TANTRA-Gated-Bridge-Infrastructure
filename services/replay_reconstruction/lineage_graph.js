const store = require('../replay_persistence/append_only_store');
const lineage = require('../replay_persistence/lineage_tracker');

function buildFullLineageGraph() {
  const allRecords = store.getAllRecords();
  const traceIds = [...new Set(allRecords.map(r => r.trace_id))];
  const graphs = traceIds.map(id => lineage.buildLineageGraph(id));

  const totalNodes = new Map();
  const totalEdges = [];
  const traceSummary = [];

  for (const graph of graphs) {
    for (const node of graph.nodes) {
      const key = `${graph.trace_id}:${node.execution_id}`;
      if (!totalNodes.has(key)) {
        totalNodes.set(key, { ...node, trace_id: graph.trace_id });
      }
    }
    for (const edge of graph.edges) {
      totalEdges.push({ ...edge, trace_id: graph.trace_id });
    }
    traceSummary.push({
      trace_id: graph.trace_id,
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      record_count: graph.record_count
    });
  }

  return {
    total_traces: traceIds.length,
    total_nodes: totalNodes.size,
    total_edges: totalEdges.length,
    traces: traceSummary,
    nodes: [...totalNodes.values()],
    edges: totalEdges
  };
}

function findLineagePath(fromExecutionId, toExecutionId) {
  const allGraphs = buildFullLineageGraph();
  const path = [];
  const visited = new Set();

  function bfs(startId, targetId) {
    const queue = [[startId]];
    while (queue.length > 0) {
      const currentPath = queue.shift();
      const current = currentPath[currentPath.length - 1];
      if (current === targetId) return currentPath;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const edge of allGraphs.edges) {
        if (edge.from === current) {
          queue.push([...currentPath, edge.to]);
        }
      }
    }
    return null;
  }

  const foundPath = bfs(fromExecutionId, toExecutionId);
  return {
    from: fromExecutionId,
    to: toExecutionId,
    path_found: foundPath !== null,
    path: foundPath || [],
    path_length: foundPath ? foundPath.length - 1 : 0
  };
}

function getLineageDepth() {
  const graph = buildFullLineageGraph();
  let maxDepth = 0;
  let maxDepthTrace = null;

  for (const trace of graph.traces) {
    if (trace.node_count > maxDepth) {
      maxDepth = trace.node_count;
      maxDepthTrace = trace.trace_id;
    }
  }

  return {
    max_depth: maxDepth,
    max_depth_trace: maxDepthTrace,
    average_depth: graph.total_nodes / Math.max(graph.total_traces, 1),
    total_nodes: graph.total_nodes,
    total_edges: graph.total_edges
  };
}

module.exports = {
  buildFullLineageGraph,
  findLineagePath,
  getLineageDepth
};
