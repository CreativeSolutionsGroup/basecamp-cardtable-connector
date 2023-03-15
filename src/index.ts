/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	basecamp: KVNamespace;

	CLIENT_ID: string;
	CLIENT_SECRET: string;
	REDIRECT_URI: string;
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		{
			const bearer = await env.basecamp.get("bearer");
			const authRequest = await fetch("https://launchpad.37signals.com/authorization.json", {
				method: "GET",
				headers: new Headers({
					"Authorization": "Bearer " + bearer
				})
			});
			if (authRequest.status === 403) {
				const refresh = await env.basecamp.get("refresh");
				const refreshResponse = await fetch(`https://launchpad.37signals.com/authorization/token?type=refresh&refresh_token=${refresh}&client_id=${env.CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&client_secret=${env.CLIENT_SECRET}`, {
					method: "POST"
				});
				const newToken = await refreshResponse.json() as { access_token: string, expires_in: number };
				await env.basecamp.put("bearer", newToken.access_token)
			}
		}

		const bearer = await env.basecamp.get("bearer");
		const formJson: { Title: string, Description: string, "Date due": string, "projectId": string, "listId": string } = await request.json();
		console.log("Received this data from google forms:");
		console.log(formJson);
		const nextWeek = new Date()
		nextWeek.setDate(nextWeek.getDate() + 7);
		const basecampData = {
			title: formJson["Title"],
			content: formJson["Description"],
			due_on: formJson["Date due"] ? formJson["Date due"] : nextWeek.toISOString().slice(0, 10)
		}
		console.log("Sending the following data to a Basecamp card table:");
		console.log(basecampData);
		const basecampURL = `https://3.basecampapi.com/5395843/buckets/${formJson.projectId}/card_tables/lists/${formJson.listId}/cards.json`;
		const response = await fetch(basecampURL, {
			method: "POST",
			headers: new Headers({
				"Authorization": "Bearer " + bearer,
				"Content-Type": "application/json",
				"Accept": "*/*",
				"User-Agent": "Forms to basecamp adapter (alexandertaylor@cedarville.edu)"
			}),
			body: JSON.stringify(basecampData)
		});
		console.log("Received response " + response.status);

		return new Response("200/OK")
	},
};
