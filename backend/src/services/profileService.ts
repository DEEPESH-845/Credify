import * as userRepository from "../repositories/userRepository";
import * as ipfsService from "./ipfsService";
import { User, UpdateUserData } from "../types/models";

export interface CreateProfileData {
  wallet_address: string;
  display_name?: string;
  headline?: string;
  bio?: string;
  location?: string;
}

/**
 * Creates a new user profile. If a profile already exists for the given
 * wallet address, returns the existing profile without modification.
 */
export async function createProfile(data: CreateProfileData): Promise<User> {
  const normalizedAddress = data.wallet_address.toLowerCase();

  const existing = await userRepository.findByAddress(normalizedAddress);
  if (existing) {
    return existing;
  }

  const user = await userRepository.create(normalizedAddress);

  // If optional fields were provided, update the newly created profile
  const updateData: UpdateUserData = {};
  if (data.display_name !== undefined) updateData.display_name = data.display_name;
  if (data.headline !== undefined) updateData.headline = data.headline;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.location !== undefined) updateData.location = data.location;

  if (Object.keys(updateData).length > 0) {
    const updated = await userRepository.update(normalizedAddress, updateData);
    return updated ?? user;
  }

  return user;
}

/**
 * Retrieves a user profile by wallet address.
 * Returns null if no profile exists.
 */
export async function getProfile(walletAddress: string): Promise<User | null> {
  return userRepository.findByAddress(walletAddress.toLowerCase());
}

/**
 * Updates a user profile. Enforces ownership — the requester's address
 * must match the profile's wallet address.
 *
 * Throws with code FORBIDDEN if the requester is not the profile owner.
 * Throws with code NOT_FOUND if the profile does not exist.
 */
export async function updateProfile(
  profileAddress: string,
  requesterAddress: string,
  data: UpdateUserData
): Promise<User> {
  const normalizedProfile = profileAddress.toLowerCase();
  const normalizedRequester = requesterAddress.toLowerCase();

  if (normalizedProfile !== normalizedRequester) {
    const error = new Error("You can only update your own profile");
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  const existing = await userRepository.findByAddress(normalizedProfile);
  if (!existing) {
    const error = new Error("Profile not found");
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  const updated = await userRepository.update(normalizedProfile, data);
  return updated ?? existing;
}

/**
 * Uploads a profile image to IPFS and stores the CID on the user's profile.
 *
 * Enforces ownership — the requester's address must match the profile address.
 * Throws with code FORBIDDEN if the requester is not the profile owner.
 * Throws with code NOT_FOUND if the profile does not exist.
 *
 * @returns The IPFS CID of the uploaded image.
 */
export async function uploadProfileImage(
  profileAddress: string,
  requesterAddress: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ cid: string; profile: User }> {
  const normalizedProfile = profileAddress.toLowerCase();
  const normalizedRequester = requesterAddress.toLowerCase();

  if (normalizedProfile !== normalizedRequester) {
    const error = new Error("You can only upload an image to your own profile");
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  const existing = await userRepository.findByAddress(normalizedProfile);
  if (!existing) {
    const error = new Error("Profile not found");
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  // Delegate to IPFS service — this may throw FileTooLargeError or UnsupportedFileTypeError
  // Validate image type first
  if (!ipfsService.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new ipfsService.UnsupportedFileTypeError(ipfsService.ALLOWED_IMAGE_TYPES);
  }
  const cid = await ipfsService.uploadAndStore(fileBuffer, mimeType);

  // Store the CID on the profile
  const updated = await userRepository.update(normalizedProfile, {
    profile_image_cid: cid,
  });

  return { cid, profile: updated ?? existing };
}
