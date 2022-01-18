var socket = io();

socket.on("tts-event", function (msg) {
  document.write(msg);
});
