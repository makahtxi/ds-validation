figma.showUI(__html__, { width: 340, height: 240, title: "DS Validation" });

function collectVariables() {
  var variables = figma.variables.getLocalVariables();
  var result = {};
  for (var i = 0; i < variables.length; i++) {
    var v = variables[i];
    result[v.id] = {
      id: v.id,
      name: v.name,
      variableCollectionId: v.variableCollectionId,
      resolvedType: v.resolvedType,
      valuesByMode: v.valuesByMode,
    };
  }
  return result;
}

figma.ui.onmessage = function (msg) {
  if (msg.type === "fetch") {
    figma.ui.postMessage({ type: "variables", data: collectVariables() });
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
};

// Auto-fetch on open
figma.ui.postMessage({ type: "variables", data: collectVariables() });
