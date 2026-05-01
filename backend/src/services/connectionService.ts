import * as connectionRepository from "../repositories/connectionRepository";
import * as userRepository from "../repositories/userRepository";
import { Connection, User } from "../types/models";

export interface ConnectionWithProfile extends Connection {
  profile?: Pick<User, "wallet_address" | "display_name" | "headline" | "profile_image_cid">;
}

/**
 * Sends a connection request from the requester to the recipient.
 *
 * Throws with code DUPLICATE_CONNECTION if a connection (any status) already exists
 * between the two addresses.
 * Throws with code VALIDATION_ERROR if the requester tries to connect with themselves.
 */
export async function sendRequest(
  requesterAddress: string,
  recipientAddress: string
): Promise<Connection> {
  const normalizedRequester = requesterAddress.toLowerCase();
  const normalizedRecipient = recipientAddress.toLowerCase();

  if (normalizedRequester === normalizedRecipient) {
    const error = new Error("Cannot send a connection request to yourself");
    (error as any).code = "VALIDATION_ERROR";
    throw error;
  }

  // Check if a connection already exists in either direction
  const existing = await connectionRepository.findExisting(
    normalizedRequester,
    normalizedRecipient
  );

  if (existing) {
    const error = new Error("A connection request already exists between these users");
    (error as any).code = "DUPLICATE_CONNECTION";
    throw error;
  }

  // Verify recipient exists
  const recipientUser = await userRepository.findByAddress(normalizedRecipient);
  if (!recipientUser) {
    const error = new Error("Recipient user not found");
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  return connectionRepository.create(normalizedRequester, normalizedRecipient);
}

/**
 * Accepts a pending connection request.
 *
 * Only the recipient of the request can accept it.
 * Throws with code NOT_FOUND if the connection does not exist.
 * Throws with code FORBIDDEN if the caller is not the recipient.
 * Throws with code VALIDATION_ERROR if the connection is not in pending status.
 */
export async function acceptRequest(
  connectionId: number,
  callerAddress: string
): Promise<Connection> {
  const normalizedCaller = callerAddress.toLowerCase();

  const connection = await connectionRepository.findById(connectionId);
  if (!connection) {
    const error = new Error("Connection not found");
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  if (connection.recipient_address !== normalizedCaller) {
    const error = new Error("Only the recipient can accept a connection request");
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  if (connection.status !== "pending") {
    const error = new Error("Connection request is not pending");
    (error as any).code = "VALIDATION_ERROR";
    throw error;
  }

  const updated = await connectionRepository.updateStatus(connectionId, "accepted");
  return updated!;
}

/**
 * Declines a pending connection request.
 *
 * Only the recipient of the request can decline it.
 * Throws with code NOT_FOUND if the connection does not exist.
 * Throws with code FORBIDDEN if the caller is not the recipient.
 * Throws with code VALIDATION_ERROR if the connection is not in pending status.
 */
export async function declineRequest(
  connectionId: number,
  callerAddress: string
): Promise<Connection> {
  const normalizedCaller = callerAddress.toLowerCase();

  const connection = await connectionRepository.findById(connectionId);
  if (!connection) {
    const error = new Error("Connection not found");
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  if (connection.recipient_address !== normalizedCaller) {
    const error = new Error("Only the recipient can decline a connection request");
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  if (connection.status !== "pending") {
    const error = new Error("Connection request is not pending");
    (error as any).code = "VALIDATION_ERROR";
    throw error;
  }

  const updated = await connectionRepository.updateStatus(connectionId, "declined");
  return updated!;
}

/**
 * Returns a paginated list of connections for the given user filtered by status,
 * enriched with profile summary data for the connected user.
 */
export async function listConnections(
  walletAddress: string,
  page: number,
  limit: number,
  status: "pending" | "accepted" | "declined" = "accepted"
): Promise<{
  connections: ConnectionWithProfile[];
  total: number;
  page: number;
  limit: number;
}> {
  const normalizedAddress = walletAddress.toLowerCase();

  const { connections, total } = await connectionRepository.findByUser(
    normalizedAddress,
    page,
    limit,
    status
  );

  // Enrich each connection with the other user's profile summary
  const enriched: ConnectionWithProfile[] = await Promise.all(
    connections.map(async (conn) => {
      const otherAddress =
        conn.requester_address === normalizedAddress
          ? conn.recipient_address
          : conn.requester_address;

      const user = await userRepository.findByAddress(otherAddress);

      return {
        ...conn,
        profile: user
          ? {
              wallet_address: user.wallet_address,
              display_name: user.display_name,
              headline: user.headline,
              profile_image_cid: user.profile_image_cid,
            }
          : undefined,
      };
    })
  );

  return { connections: enriched, total, page, limit };
}
