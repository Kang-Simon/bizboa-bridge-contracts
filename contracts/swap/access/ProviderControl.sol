// contracts/access/ProviderControl.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ManagerControl.sol";

contract ProviderControl is ManagerControl {
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    address private _provider;
    uint256 private _mintableAmount;

    constructor(address providerAddress_) {
        _setupRole(PROVIDER_ROLE, providerAddress_);
        enableAllowManagerIncludedTransfer();
    }

    /**
     * @dev Throws if called by any account other than the provider.
     */
    modifier onlyProvider() {
        require(_provider == _msgSender(), "ProviderControl: caller is not the provider");
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
    ) internal view virtual override {
        if (isAllowManagerIncludedTransfer()) {
            if (
                !(hasRole(role, alice) || hasRole(role, bob)) &&
                !(hasRole(PROVIDER_ROLE, alice) || hasRole(PROVIDER_ROLE, bob))
            ) {
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

    event ChangedProvider(address indexed previousProvider, address indexed newProvider);
    event AddedMintableAmount(address indexed nowProvider, uint256 addedMintableAmount, uint256 totalMintableAmount);

    function transferProvider(address newProvider) public virtual onlyOwner {
        require(newProvider != address(0), "ProviderControl: new provider is the zero address");
        address oldProvider = _provider;
        _provider = newProvider;
        emit ChangedProvider(oldProvider, newProvider);
    }

    function getProvider() public view virtual returns (address) {
        return _provider;
    }

    function addMintableAmount(uint256 amount) public virtual onlyManager {
        require(amount > 0, "Invalid amount.");
        _mintableAmount = _mintableAmount + amount;

        emit AddedMintableAmount(getProvider(), amount, _mintableAmount);
    }

    function getMintableAmount() public view virtual returns (uint256) {
        return _mintableAmount;
    }

    function subMintableAmount(uint256 amount) internal virtual {
        _mintableAmount = _mintableAmount - amount;
    }
}
