self.addEventListener("push", function (event) {
  var data = event.data ? event.data.json() : {};
  var title = data.title || "DeltaJalan";
  var options = {
    body: data.message || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = event.notification.data ? event.notification.data.url || "/" : "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
