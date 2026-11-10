export default function handler(request, response) {
  response.statusCode = 200;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("x-idb-runtime", "ping-v1");
  response.end(JSON.stringify({ ping: true, url: request.url }));
}
