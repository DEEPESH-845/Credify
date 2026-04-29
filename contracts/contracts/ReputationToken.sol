// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationToken
 * @notice Soulbound ERC-20 token that tracks professional reputation through
 *         peer endorsements. Tokens are minted when a user is endorsed and
 *         cannot be transferred between accounts.
 *         The contract owner can configure the reward amount per endorsement.
 */
contract ReputationToken is ERC20, Ownable {
    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    /// @dev endorser => skillId => endorsed => whether the endorsement exists
    mapping(address => mapping(string => mapping(address => bool))) private _endorsements;

    /// @dev user => skillId => total endorsement count
    mapping(address => mapping(string => uint256)) private _endorsementCounts;

    /// @notice Number of reputation tokens minted per endorsement
    uint256 public rewardAmount;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event EndorsementRecorded(
        address indexed endorser,
        address indexed endorsed,
        string skillId
    );

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor() ERC20("ReputationToken", "REP") Ownable(msg.sender) {
        rewardAmount = 10 * 10 ** decimals();
    }

    // ---------------------------------------------------------------
    // Soulbound enforcement
    // ---------------------------------------------------------------

    /**
     * @dev Override the internal _update hook to prevent transfers between
     *      non-zero addresses. Only minting (from == address(0)) and burning
     *      (to == address(0)) are permitted.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        if (from != address(0) && to != address(0)) {
            revert("ReputationToken: tokens are non-transferable");
        }
        super._update(from, to, value);
    }

    // ---------------------------------------------------------------
    // Endorsement operations
    // ---------------------------------------------------------------

    /**
     * @notice Endorse another user for a specific skill. Mints reward tokens
     *         to the endorsed user.
     * @param endorsed The address being endorsed.
     * @param skillId  A non-empty skill identifier string.
     */
    function endorse(address endorsed, string calldata skillId) external {
        // --- checks ---
        require(endorsed != address(0), "Invalid address: zero address");
        require(
            bytes(skillId).length > 0,
            "ReputationToken: skill identifier cannot be empty"
        );
        require(
            msg.sender != endorsed,
            "ReputationToken: cannot endorse yourself"
        );
        require(
            !_endorsements[msg.sender][skillId][endorsed],
            "ReputationToken: already endorsed this skill"
        );

        // --- effects ---
        _endorsements[msg.sender][skillId][endorsed] = true;
        _endorsementCounts[endorsed][skillId] += 1;

        // --- interactions ---
        _mint(endorsed, rewardAmount);

        emit EndorsementRecorded(msg.sender, endorsed, skillId);
    }

    // ---------------------------------------------------------------
    // Read functions
    // ---------------------------------------------------------------

    /**
     * @notice Get the total number of endorsements a user has received for a skill.
     * @param user    The endorsed user's address.
     * @param skillId The skill identifier to query.
     * @return The endorsement count.
     */
    function getEndorsementCount(
        address user,
        string calldata skillId
    ) external view returns (uint256) {
        return _endorsementCounts[user][skillId];
    }

    /**
     * @notice Check whether a specific endorsement exists.
     * @param endorser The address that gave the endorsement.
     * @param endorsed The address that received the endorsement.
     * @param skillId  The skill identifier.
     * @return True if the endorsement exists.
     */
    function hasEndorsed(
        address endorser,
        address endorsed,
        string calldata skillId
    ) external view returns (bool) {
        return _endorsements[endorser][skillId][endorsed];
    }

    // ---------------------------------------------------------------
    // Configuration (owner only)
    // ---------------------------------------------------------------

    /**
     * @notice Update the number of tokens minted per endorsement.
     * @param amount The new reward amount (in token base units).
     */
    function setRewardAmount(uint256 amount) external onlyOwner {
        rewardAmount = amount;
    }
}
