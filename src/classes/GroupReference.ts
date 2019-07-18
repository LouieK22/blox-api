import * as request from "superagent";
import * as cheerio from "cheerio";

import { IRobloxSession } from "..";
import { getCSRFToken } from "../lib/auth";

/**
 * A roleset for a Roblox group
 */
export interface IRoleset {
	id: number,
	name: string,
	rank: number,
	memberCount: number
}

/**
 * A reference to a Roblox group
 */
export class GroupReference {
	/**
	 * Session used for authenticating API calls
	 */
	private session: IRobloxSession;

	/**
	 * ID of the group on Roblox
	 */
	public groupId: number;

	/**
	 * Create a new [[GroupReference]]
	 *
	 * @param groupId The ID of the group on Roblox
	 * @param session A session used for authenticating API calls
	 */
	constructor(groupId: number, session: IRobloxSession) {
		this.groupId = groupId;
		this.session = session;
	}

	/**
	 * Get a list of rolesets within the group
	 */
	public async getRoles(): Promise<Array<IRoleset>> {
		const httpRes = await request
			.get(`https://groups.roblox.com/v1/groups/${this.groupId}/roles`);

		return httpRes.body.roles;
	}

	/**
	 * Get the roleset of a group corresponding to a specific rank
	 *
	 * @param rank Rank of the roleset
	 */
	public async getRolesetByRank(rank: number): Promise<IRoleset | undefined> {
		const roles = await this.getRoles();

		for (const role of roles) {
			if (role.rank === rank) {
				return role;
			}
		}

		return undefined;
	}

	/**
	 * Updates a user's rank in the group to a new rank
	 *
	 * @param userId ID of the user to update
	 * @param newRank New rank for the user
	 */
	public async setUserRank(userId: number, newRank: number) {
		const csrfToken = await getCSRFToken(this.session);

		const roleset = await this.getRolesetByRank(newRank);

		if (!roleset) {
			throw new Error("There is no roleset with the rank " + newRank);
		}

		await request
			.patch(`https://groups.roblox.com/v1/groups/${this.groupId}/users/${userId}`)
			.set("Cookie", this.session.cookie)
			.set("X-CSRF-TOKEN", csrfToken)
			.send({
				roleId: roleset.id,
			});
	}

	/**
	 * Exiles a user from the group
	 *
	 * @param userId User to exile
	 */
	public async exileUser(userId: number) {
		const csrfToken = await getCSRFToken(this.session);

		await request
			.delete(`https://groups.roblox.com/v1/groups/${this.groupId}/users/${userId}`)
			.set("Cookie", this.session.cookie)
			.set("X-CSRF-TOKEN", csrfToken);
	}

	/**
	 * Get the internal join request ID for a specific user
	 *
	 * @param username Username of the pending user
	 */
	public async getJoinRequestId(username: string) {
		const httpRes = await request
			.get(`https://www.roblox.com/groups/${this.groupId}/joinrequests-html`)
			.query({
				username,
			})
			.set("Cookie", this.session.cookie);

		const $ = cheerio.load(httpRes.text);
		const found = $("#JoinRequestsList").find("tr");
		const len = found.length;

		if (len === 1) {
			throw new Error("Join request does not exist");
		}

		for (let i = 1; i < len - 1; i++) {
			const data = found.eq(i).find("td");

			if (data.eq(1).text() === username) {
				return data.eq(3).find("span").attr("data-rbx-join-request");
			}
		}

		throw new Error("Join request does not exist");
	}

	public async acceptJoinRequest(username: string) {
		const joinRequestId = await this.getJoinRequestId(username);
		const csrfToken = await getCSRFToken(this.session);

		await request
			.post("https://www.roblox.com/group/handle-join-request")
			.set("Cookie", this.session.cookie)
			.set("X-CSRF-TOKEN", csrfToken)
			.send({
				groupJoinRequestId: joinRequestId,
			});
	}
}
