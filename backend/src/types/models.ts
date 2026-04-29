export interface User {
  id: number;
  wallet_address: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  profile_image_cid: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateUserData {
  display_name?: string;
  headline?: string;
  bio?: string;
  location?: string;
  profile_image_cid?: string;
}

export interface Nonce {
  id: number;
  wallet_address: string;
  nonce: string;
  created_at: Date;
  expires_at: Date;
}

export interface Connection {
  id: number;
  requester_address: string;
  recipient_address: string;
  status: "pending" | "accepted" | "declined";
  created_at: Date;
  updated_at: Date;
}

export interface Post {
  id: number;
  author_address: string;
  content: string;
  created_at: Date;
}
