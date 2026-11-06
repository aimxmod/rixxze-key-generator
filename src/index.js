export default {
  async fetch(request) {
    const url = new URL(request.url);

    return new Response(
      JSON.stringify({
        status: "online",
        worker: "rixxze-key-generator",
        path: url.pathname
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
