import * as request from "superagent";
import { IRobloxSession } from "./auth";

/**
 * Information about the logged in user, received from https://www.roblox.com/mobileapi/userinfo
 */
export interface IUserInfo {
	UserId: number
	UserName: string
	RobuxBalance: number
	TicketsBalance: number
	ThumbnailUrl: string
	IsAnyBuildersClubMember: boolean
	IsPremium: boolean
}

/**
 * Fetchs information about the logged-in user
 *
 * @param session Current [[RobloxClient]] session
 */
export async function getUserFromSession(session: IRobloxSession): Promise<IUserInfo> {
	try {
		const httpRes = await request
			.get("https://www.roblox.com/mobileapi/userinfo")
			.set("Accept", "*/*")
			.set("Cookie", session.cookie);

		return httpRes.body;
	} catch (e) {
		throw new Error(e);
	}
}
