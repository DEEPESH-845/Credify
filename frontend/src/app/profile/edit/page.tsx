"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  ProfileData,
  ApiRequestError,
} from "@/lib/api";

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs";

interface FormErrors {
  display_name?: string;
  headline?: string;
  location?: string;
}

function validateForm(fields: {
  display_name: string;
  headline: string;
  bio: string;
  location: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (fields.display_name.length > 100) {
    errors.display_name = "Display name must be 100 characters or fewer";
  }
  if (fields.headline.length > 200) {
    errors.headline = "Headline must be 200 characters or fewer";
  }
  if (fields.location.length > 100) {
    errors.location = "Location must be 100 characters or fewer";
  }

  return errors;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const { address, jwt } = useWallet();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [profileImageCid, setProfileImageCid] = useState<string | null>(null);

  // Redirect to /login if not authenticated
  useEffect(() => {
    if (!jwt || !address) {
      router.replace("/login");
    }
  }, [jwt, address, router]);

  // Load current profile on mount
  const loadProfile = useCallback(async () => {
    if (!address || !jwt) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const profile: ProfileData = await getProfile(address, jwt);
      setDisplayName(profile.display_name || "");
      setHeadline(profile.headline || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setProfileImageCid(profile.profile_image_cid);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  }, [address, jwt]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const errors = validateForm({
      display_name: displayName,
      headline,
      bio,
      location,
    });
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (!address || !jwt) return;

    setSaving(true);

    try {
      await updateProfile(
        address,
        {
          display_name: displayName,
          headline,
          bio,
          location,
        },
        jwt
      );
      setSuccessMessage("Profile updated successfully");
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address || !jwt) return;

    setSuccessMessage(null);
    setErrorMessage(null);
    setUploading(true);

    try {
      const updatedProfile = await uploadProfileImage(address, file, jwt);
      setProfileImageCid(updatedProfile.profile_image_cid);
      setSuccessMessage("Profile image uploaded successfully");
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to upload profile image");
      }
    } finally {
      setUploading(false);
    }
  };

  if (!jwt || !address) {
    return null;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
            role="status"
            aria-label="Loading"
          />
          <p className="text-sm text-gray-600">Loading profile...</p>
        </div>
      </main>
    );
  }

  const profileImageUrl = profileImageCid
    ? `${IPFS_GATEWAY}/${profileImageCid}`
    : null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Update your professional profile information
          </p>

          {successMessage && (
            <div
              role="status"
              className="mt-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700"
            >
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          {/* Profile Image Section */}
          <div className="mt-6 border-b border-gray-200 pb-6">
            <h2 className="text-sm font-semibold text-gray-700">
              Profile Image
            </h2>
            <div className="mt-3 flex items-center gap-4">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600 border-2 border-gray-200"
                  aria-label="Default avatar"
                >
                  {displayName?.[0]?.toUpperCase() || address[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div>
                <label
                  htmlFor="profile-image-upload"
                  className={`inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${
                    uploading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {uploading ? "Uploading..." : "Change Image"}
                  <input
                    id="profile-image-upload"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="sr-only"
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  JPEG or PNG format
                </p>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSave} className="mt-6 space-y-5">
            {/* Display Name */}
            <div>
              <label
                htmlFor="display-name"
                className="block text-sm font-medium text-gray-700"
              >
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.display_name
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Your display name"
              />
              <div className="mt-1 flex justify-between">
                {formErrors.display_name ? (
                  <p className="text-xs text-red-600">
                    {formErrors.display_name}
                  </p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-gray-400">
                  {displayName.length}/100
                </p>
              </div>
            </div>

            {/* Headline */}
            <div>
              <label
                htmlFor="headline"
                className="block text-sm font-medium text-gray-700"
              >
                Headline
              </label>
              <input
                id="headline"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={200}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.headline
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="e.g. Senior Blockchain Developer"
              />
              <div className="mt-1 flex justify-between">
                {formErrors.headline ? (
                  <p className="text-xs text-red-600">
                    {formErrors.headline}
                  </p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-gray-400">
                  {headline.length}/200
                </p>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block text-sm font-medium text-gray-700"
              >
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tell others about yourself..."
              />
            </div>

            {/* Location */}
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700"
              >
                Location
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.location
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="e.g. San Francisco, CA"
              />
              <div className="mt-1 flex justify-between">
                {formErrors.location ? (
                  <p className="text-xs text-red-600">
                    {formErrors.location}
                  </p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-gray-400">
                  {location.length}/100
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/profile/${address}`)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
