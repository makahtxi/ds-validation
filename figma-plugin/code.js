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

function payload() {
  return {
    type: "variables",
    fileKey: figma.fileKey || "",
    data: collectVariables(),
  };
}

figma.ui.onmessage = function (msg) {
  if (msg.type === "fetch") {
    figma.ui.postMessage(payload());
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
};

// Auto-fetch on open
figma.ui.postMessage(payload());
