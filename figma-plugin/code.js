// DS Validation Plugin
// Supports two modes:
// 1. CLI (localhost) — original mode, sends to local server
// 2. Hosted — uses a pairing code from the web app

figma.showUI(__html__, { width: 380, height: 480, title: "DS Validation" });

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

// Get the current file key from the document URL
function getFileKey() {
  var url = figma.fileKey;
  return url || "";
}

figma.ui.onmessage = function (msg) {
  if (msg.type === "fetch") {
    figma.ui.postMessage({ type: "variables", data: collectVariables(), fileKey: getFileKey() });
  }
  if (msg.type === "send-localhost") {
    var port = msg.port || "7070";
    var data = msg.data;
    setStatus("info", "Sending to localhost:" + port + "…");
    fetch("http://localhost:" + port + "/variables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        if (res.ok) {
          setStatus("ok", "Variables sent to localhost:" + port + " — you can close this plugin.");
        } else {
          setStatus("error", "Server error " + res.status + ". Is the CLI running?");
        }
      })
      .catch(function () {
        setStatus("error", "Could not reach localhost:" + port + ". Start the CLI first, then try again.");
      });
  }
  if (msg.type === "send-hosted") {
    var code = msg.code;
    var fileKey = msg.fileKey;
    var payload = msg.data;
    var serverUrl = msg.serverUrl || "https://ds-validation.com";
    setStatus("info", "Sending variables to " + serverUrl + "…");

    fetch(serverUrl + "/api/variable-uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        fileKey: fileKey,
        payload: payload,
      }),
    })
      .then(function (res) {
        if (res.ok) {
          setStatus("ok", "Variables sent successfully! You can close this plugin.");
        } else {
          return res.json().then(function (data) {
            setStatus("error", data.error || "Server error " + res.status);
          }).catch(function () {
            setStatus("error", "Server error " + res.status);
          });
        }
      })
      .catch(function () {
        setStatus("error", "Could not reach the server. Please check your connection and try again.");
      });
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
};

// Auto-fetch on open
figma.ui.postMessage({ type: "variables", data: collectVariables(), fileKey: getFileKey() });

function setStatus(cls, msg) {
  figma.ui.postMessage({ type: "status", cls: cls, msg: msg });
}