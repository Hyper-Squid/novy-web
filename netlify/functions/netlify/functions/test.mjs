
export default async function handler() {
  return new Response(
    JSON.stringify({
      status: "funguje",
      sprava: "Netlify Functions fungujú!"
    }),
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
