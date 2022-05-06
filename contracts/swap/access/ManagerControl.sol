// contracts/access/ManagerControl.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ManagerControl is AccessControl, Ownable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @dev Whether to allow administrator-included transfers only
    bool private _useAllowManagerIncludedTransfer;

    /// @dev Add `root` to the manager role as a member.
    constructor() {
        _useAllowManagerIncludedTransfer = true;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MANAGER_ROLE, _msgSender());
        _setRoleAdmin(MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /**
     * @dev Throws if called by any account other than the manager.
     */
    modifier onlyManager() {
        require(isManager(_msgSender()), "ManagerControl: caller is not the manager");
        _;
    }

    /**
     * @dev Modifier that checks that an account or sender has a specific role.
     * Reverts with a standardized message including the required role.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
     *
     */
    modifier includedManager(bytes32 role, address account) {
        _checkRoleBoth(role, _msgSender(), account);
        _;
    }

    /**
     * @dev Revert with a standard message if `alice` or `bob` is missing `role`.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
     */
    function _checkRoleBoth(
        bytes32 role,
        address alice,
        address bob
    ) internal view virtual {
        if (_useAllowManagerIncludedTransfer) {
            if (!(hasRole(role, alice) || hasRole(role, bob))) {
                revert(
                    string(
                        abi.encodePacked(
                            "AccessControl: Do not transfer between regular accounts.",
                            Strings.toHexString(uint256(role), 32)
                        )
                    )
                );
            }
        }
    }

    /// @dev Return `true` if the `account` is manager
    function isManager(address account) public view virtual returns (bool) {
        return hasRole(MANAGER_ROLE, account);
    }

    /// @dev Add a manager.
    function addManager(address account) public virtual onlyOwner {
        grantRole(MANAGER_ROLE, account);
    }

    /// @dev Remove a manager.
    function removeManager(address account) public virtual onlyOwner {
        revokeRole(MANAGER_ROLE, account);
    }

    /// @dev Enable allow manager-included transfers only.
    function enableAllowManagerIncludedTransfer() public virtual onlyRole(MANAGER_ROLE) {
        _useAllowManagerIncludedTransfer = true;
    }

    /// @dev Disable allow manager-included transfers only.
    function disableAllowManagerIncludedTransfer() public virtual onlyRole(MANAGER_ROLE) {
        _useAllowManagerIncludedTransfer = false;
    }

    /// @dev Return whether to allow manager-included transfers only
    function isAllowManagerIncludedTransfer() public view virtual returns (bool) {
        return _useAllowManagerIncludedTransfer;
    }
}
