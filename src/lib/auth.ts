import * as request from "superagent";

export interface IRobloxSession {
	cookie: string,
}

/**
 * Gets the current CSRF token by sending an invalid request to the sign-out endpoint
 *
 * @param session Current [[RobloxClient]] session
 */
export async function getCSRFToken(session: IRobloxSession) {
	try {
		const httpRes = await request
			.post("https://api.roblox.com/sign-out/v1")
			.set("Cookie", session.cookie)
			.redirects(0)
			.ok((res) => {
				return res.status === 403;
			});

		const csrfToken: string = httpRes.header["x-csrf-token"];

		if (csrfToken) {
			return csrfToken;
		} else {
			throw new Error("Did not receive x-csrf-token header");
		}
	} catch (e) {
		throw new Error(e);
	}
}

/**
 * Gets the token required to make changes to security settings
 *
 * @param session Current [[RobloxClient]] session
 */
export async function getSecuritySettingsToken(session: IRobloxSession): Promise<string> {
	try {
		const httpRes = await request
			.get("https://www.roblox.com/my/account#!/security")
			.set("Cookie", session.cookie)
			.set("Accept", "*/*")
			.redirects(0)
			.ok((res) => {
				return res.status === 200 || res.status === 302;
			});

		if (httpRes.status === 302) {
			throw new Error("Invalid cookie: " + session.cookie);
		}

		if (httpRes.header["set-cookie"]) {
			const match = httpRes.header["set-cookie"].toString().match(/__RequestVerificationToken=(.*?);/);

			if (match) {
				return match[1];
			}
		}

		throw new Error("Did not receive __RequestVerificationToken");
	} catch (e) {
		throw new Error(e);
	}
}

/**
 * Signs out all other sessions and generates a new .ROBLOSECURITY cookie
 *
 * @param cookie .ROBLOSECURITY cookie value
 */
export async function refreshSessionFromCookie(cookie: string) {
	const newSession: IRobloxSession = {
		cookie,
	};

	if (!newSession.cookie.includes(".ROBLOSECURITY=")) {
		newSession.cookie = ".ROBLOSECURITY=" + cookie;
	}

	const secToken = await getSecuritySettingsToken(newSession);
	const csrfToken = await getCSRFToken(newSession);

	const httpRes = await request
		.post("https://www.roblox.com/authentication/signoutfromallsessionsandreauthenticate")
		.send("__RequestVerificationToken=" + secToken)
		.set("X-CSRF-TOKEN", csrfToken)
		.set("Cookie", newSession.cookie);

	if (httpRes.header["set-cookie"]) {
		const match = httpRes.header["set-cookie"].toString().match(/\.ROBLOSECURITY=(.*?);/);

		if (match) {
			newSession.cookie = ".ROBLOSECURITY=" + match[1];
		} else {
			throw new Error(".ROBLOSECURITY was not set");
		}
	} else {
		throw new Error("No cookies were set");
	}

	return newSession;
}
