import { IRobloxSession, refreshSessionFromCookie } from "../lib/auth";
import Keyv from "keyv";
import KeyvFile from "keyv-file";
import * as path from "path";
import { getUserFromSession } from "../lib/user";
import { GroupReference } from "./GroupReference";

/**
 * Configuration options for [[RobloxClient]]
 */
export interface IRobloxClientOptions {
	/**
	 * URI for the cache, see https://github.com/lukechilds/keyv#official-storage-adapters for supported adapters.
	 * Defaults to storing data in-memory
	 */
	cacheUri?: string

	/**
	 * URI for persistent storage, see https://github.com/lukechilds/keyv#official-storage-adapters for supported adapters.
	 * Defaults to using [keyv-file](https://www.npmjs.com/package/keyv-file)
	 */
	storageUri?: string

	/**
	 * Name of file to save persistent data when [[storageUri]] is not set.
	 * Defaults to roblox.json
	 */
	storageFileName?: string

	/**
	 * ID of the user for this client.
	 * This is only needed when loading sessions for multiple accounts
	 */
	userId?: string
}

export class RobloxClient {
	/**
	 * Current user session, created by [[login]]
	 */
	private session?: IRobloxSession;

	/**
	 * Cache storage backed by [Keyv](https://github.com/lukechilds/keyv)
	 */
	private cacheKeyv: Keyv;

	/**
	 * Persistent storage of session cookies back by [Keyv](https://github.com/lukechilds/keyv)
	 */
	private storageKeyv: Keyv;

	/**
	 * Configration set in the [[constructor]]
	 */
	private options: IRobloxClientOptions;

	/**
	 * Create a new [[RobloxClient]]
	 *
	 * @param options Configuration options for a [[RobloxClient]]
	 */
	constructor(options?: IRobloxClientOptions) {
		options = options || { userId: "default" };

		if (!options.userId) {
			options.userId = "default";
		}

		this.options = options;

		this.cacheKeyv = new Keyv(options.cacheUri);
		this.cacheKeyv.on("error", (err: string) => console.error("Cache connection error: " + err));

		if (options.storageUri) {
			this.storageKeyv = new Keyv(options.storageUri);
			this.storageKeyv.on("error", (err: string) => console.error("Persistent storage connection error: " + err));
		} else {
			this.storageKeyv = new Keyv({
				store: new KeyvFile({
					filename: path.join(process.cwd(), options.storageFileName || "roblox.json"),
				}),
			});
		}
	}

	/**
	 * Authenticate the account to access secured endpoints
	 *
	 * @param cookie .ROBLOSECURITY cookie for the account
	 */
	public async login(cookie: string) {
		const userId = this.options.userId as string;

		let savedSessionIsValid = false;

		const savedSession: IRobloxSession = await this.storageKeyv.get(userId);
		if (savedSession) {
			try {
				this.session = await refreshSessionFromCookie(savedSession.cookie);

				savedSessionIsValid = true;
			} catch (err) {
				console.warn("Saved session is invalid, trying with provided cookie");

				this.storageKeyv.delete(userId);
			}

			if (savedSessionIsValid) {
				this.storageKeyv.set(userId as string, this.session);

				return;
			}
		}

		try {
			this.session = await refreshSessionFromCookie(cookie);

			this.storageKeyv.set(userId, this.session);
		} catch (err) {
			throw(err);
		}
	}

	/**
	 * Returns information about the currently logged-in user
	 */
	public async getCurrentUserInfo() {
		if (!this.session) {
			throw new Error("You must be logged in to use getCurrentUserInfo()");
		}

		return getUserFromSession(this.session);
	}

	/**
	 * Returns a [[GroupReference]] to the provided group ID
	 *
	 * @param groupId The ID of the group
	 */
	public getGroupFromId(groupId: number) {
		if (!this.session) {
			throw new Error("The RobloxClient must be logged in to create a GroupReference");
		}

		return new GroupReference(groupId, this.session);
	}
}
