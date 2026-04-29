// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredentialNFT
 * @notice Issues verifiable professional credentials as non-fungible tokens.
 *         Only addresses registered as authorized issuers may mint credentials.
 *         The contract owner manages the issuer list.
 */
contract CredentialNFT is ERC721, Ownable {
    // ---------------------------------------------------------------
    // Data structures
    // ---------------------------------------------------------------

    struct CredentialData {
        string credentialType;
        address issuer;
        address holder;
        uint256 issuanceTimestamp;
        string ipfsCID;
    }

    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    /// @dev tokenId → credential metadata
    mapping(uint256 => CredentialData) private _credentials;

    /// @dev holder address → list of token IDs they own
    mapping(address => uint256[]) private _holderTokens;

    /// @dev address → whether it is an authorized issuer
    mapping(address => bool) private _authorizedIssuers;

    /// @dev Auto-incrementing token ID counter (starts at 1)
    uint256 private _nextTokenId;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed issuer,
        address indexed holder,
        string credentialType
    );

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor() ERC721("CredentialNFT", "CRED") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    // ---------------------------------------------------------------
    // Issuer management (owner only)
    // ---------------------------------------------------------------

    /**
     * @notice Register an address as an authorized credential issuer.
     * @param issuer The address to authorize.
     */
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid address: zero address");
        _authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /**
     * @notice Remove an address from the authorized issuers list.
     * @param issuer The address to de-authorize.
     */
    function removeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid address: zero address");
        _authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /**
     * @notice Check whether an address is an authorized issuer.
     * @param addr The address to query.
     * @return True if the address is an authorized issuer.
     */
    function isAuthorizedIssuer(address addr) external view returns (bool) {
        return _authorizedIssuers[addr];
    }

    // ---------------------------------------------------------------
    // Credential operations (authorized issuers only)
    // ---------------------------------------------------------------

    /**
     * @notice Mint a new credential NFT to the holder.
     * @param holder         The recipient wallet address.
     * @param credentialType A human-readable credential type (e.g. "BSc Computer Science").
     * @param ipfsCID        The IPFS content identifier for the credential document.
     * @return tokenId       The ID of the newly minted token.
     */
    function mintCredential(
        address holder,
        string calldata credentialType,
        string calldata ipfsCID
    ) external returns (uint256 tokenId) {
        // --- checks ---
        require(
            _authorizedIssuers[msg.sender],
            "CredentialNFT: caller is not an authorized issuer"
        );
        require(holder != address(0), "Invalid address: zero address");
        require(
            bytes(credentialType).length > 0,
            "CredentialNFT: credential type cannot be empty"
        );
        require(
            bytes(ipfsCID).length > 0,
            "CredentialNFT: IPFS CID cannot be empty"
        );

        // --- effects ---
        tokenId = _nextTokenId;
        _nextTokenId++;

        _credentials[tokenId] = CredentialData({
            credentialType: credentialType,
            issuer: msg.sender,
            holder: holder,
            issuanceTimestamp: block.timestamp,
            ipfsCID: ipfsCID
        });

        _holderTokens[holder].push(tokenId);

        // --- interactions ---
        _mint(holder, tokenId);

        emit CredentialIssued(tokenId, msg.sender, holder, credentialType);
    }

    // ---------------------------------------------------------------
    // Read functions
    // ---------------------------------------------------------------

    /**
     * @notice Retrieve the full credential metadata for a given token.
     * @param tokenId The token ID to query.
     * @return The CredentialData struct.
     */
    function getCredential(
        uint256 tokenId
    ) external view returns (CredentialData memory) {
        // Ensure the token exists by checking the owner (reverts for non-existent tokens)
        _requireOwned(tokenId);
        return _credentials[tokenId];
    }

    /**
     * @notice Retrieve all token IDs held by a given address.
     * @param holder The holder address to query.
     * @return An array of token IDs.
     */
    function getHolderCredentials(
        address holder
    ) external view returns (uint256[] memory) {
        return _holderTokens[holder];
    }
}
