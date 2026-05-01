"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  ProfileData,
  ApiRequestError,
} from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import PageLayout from "@/components/PageLayout";
import { truncateAddress } from "@/lib/utils";

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

function ProfileEditContent() {
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
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

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

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(previewUrl);

    setSuccessMessage(null);
    setErrorMessage(null);
    setUploading(true);

    try {
      const updatedProfile = await uploadProfileImage(address, file, jwt);
      setProfileImageCid(updatedProfile.profile_image_cid);
      setLocalPreviewUrl(null);
      setSuccessMessage("Profile image uploaded successfully");
    } catch (err: unknown) {
      // Revert local preview on failure
      setLocalPreviewUrl(null);
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

  // Derive profile image alt text
  const profileImageAlt = useMemo(() => {
    if (displayName) {
      return `${displayName} profile photo`;
    }
    return `${truncateAddress(address || "")} profile photo`;
  }, [displayName, address]);

  const profileImageUrl = profileImageCid
    ? `${IPFS_GATEWAY}/${profileImageCid}`
    : null;

  // Use local preview during upload, fall back to IPFS URL
  const displayImageUrl = localPreviewUrl || profileImageUrl;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-primary-500"
            role="status"
            aria-label="Loading"
          />
          <p className="text-sm text-neutral-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
      <h1 className="text-2xl font-bold text-neutral-50">Edit Profile</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Update your professional profile information
      </p>

      {successMessage && (
        <div
          role="status"
          className="mt-4 rounded-md border border-success-500/20 bg-success-500/10 p-4 text-sm text-success-300"
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-error-500/20 bg-error-500/10 p-4 text-sm text-error-300"
        >
          {errorMessage}
        </div>
      )}

      {/* Profile Image Section */}
      <div className="mt-6 border-b border-white/[0.06] pb-6">
        <h2 className="text-sm font-semibold text-neutral-300">
          Profile Image
        </h2>
        <div className="mt-3 flex items-center gap-4">
          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt={profileImageAlt}
              className="h-20 w-20 rounded-full object-cover border-2 border-white/[0.06]"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-900/50 text-xl font-bold text-primary-400 border-2 border-white/[0.06]"
              aria-label="Default avatar"
            >
              {displayName?.[0]?.toUpperCase() || address?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <label
              htmlFor="profile-image-upload"
              className={`inline-flex cursor-pointer items-center rounded-md border border-white/[0.06] bg-neutral-900/50 px-4 py-2 text-sm font-medium text-neutral-300 shadow-sm hover:bg-neutral-800/80 hover:border-white/[0.1] focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 focus-within:ring-offset-neutral-950 ${
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
            <p className="mt-1 text-xs text-neutral-500">
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
            className="block text-sm font-medium text-neutral-300"
          >
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            className={`mt-1 block w-full rounded-md border bg-neutral-900/50 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus:border-primary-500 ${
              formErrors.display_name
                ? "border-error-500/50"
                : "border-white/[0.06]"
            }`}
            placeholder="Your display name"
          />
          <div className="mt-1 flex justify-between">
            {formErrors.display_name ? (
              <p className="text-xs text-error-400">
                {formErrors.display_name}
              </p>
            ) : (
              <span />
            )}
            <p className="text-xs text-neutral-500">
              {displayName.length}/100
            </p>
          </div>
        </div>

        {/* Headline */}
        <div>
          <label
            htmlFor="headline"
            className="block text-sm font-medium text-neutral-300"
          >
            Headline
          </label>
          <input
            id="headline"
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={200}
            className={`mt-1 block w-full rounded-md border bg-neutral-900/50 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus:border-primary-500 ${
              formErrors.headline
                ? "border-error-500/50"
                : "border-white/[0.06]"
            }`}
            placeholder="e.g. Senior Blockchain Developer"
          />
          <div className="mt-1 flex justify-between">
            {formErrors.headline ? (
              <p className="text-xs text-error-400">
                {formErrors.headline}
              </p>
            ) : (
              <span />
            )}
            <p className="text-xs text-neutral-500">
              {headline.length}/200
            </p>
          </div>
        </div>

        {/* Bio */}
        <div>
          <label
            htmlFor="bio"
            className="block text-sm font-medium text-neutral-300"
          >
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border border-white/[0.06] bg-neutral-900/50 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus:border-primary-500"
            placeholder="Tell others about yourself..."
          />
        </div>

        {/* Location */}
        <div>
          <label
            htmlFor="location"
            className="block text-sm font-medium text-neutral-300"
          >
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
            className={`mt-1 block w-full rounded-md border bg-neutral-900/50 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus:border-primary-500 ${
              formErrors.location
                ? "border-error-500/50"
                : "border-white/[0.06]"
            }`}
            placeholder="e.g. San Francisco, CA"
          />
          <div className="mt-1 flex justify-between">
            {formErrors.location ? (
              <p className="text-xs text-error-400">
                {formErrors.location}
              </p>
            ) : (
              <span />
            )}
            <p className="text-xs text-neutral-500">
              {location.length}/100
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/profile/${address}`)}
            className="rounded-md border border-white/[0.06] bg-neutral-900/50 px-4 py-2 text-sm font-medium text-neutral-300 shadow-sm hover:bg-neutral-800/80 hover:border-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProfileEditPage() {
  return (
    <AuthGuard>
      <PageLayout maxWidth="max-w-2xl">
        <ProfileEditContent />
      </PageLayout>
    </AuthGuard>
  );
}
