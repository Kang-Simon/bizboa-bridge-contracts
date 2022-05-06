// contracts/PointToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./access/ProviderControl.sol";

contract PointToken is ERC20, ProviderControl {
    constructor(
        string memory name_,
        string memory symbol_,
        address defaultProviderAddress_,
        address defaultManagerAddress_
    ) ERC20(name_, symbol_) ProviderControl(defaultProviderAddress_) {
        _setupRole(MANAGER_ROLE, defaultManagerAddress_);
        transferProvider(defaultProviderAddress_);
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }

    /**
     * @dev
     * Requirements:
     *
     * - the caller must have a manager role.
     * - the provider must have a mintable Amount
     */
    function mint(address account, uint256 amount) public virtual onlyManager {
        require(amount > 0, "Invalid amount.");
        require(amount <= getMintableAmount(), "PointToken: mintable exceeded for provider ");
        super._mint(account, amount);
        subMintableAmount(amount);
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Requirements:
     *
     * - the caller must have a manager role.
     */
    function burn(address from, uint256 amount) public onlyManager returns (bool) {
        _burn(from, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     * - the manager must be included in the 'caller' or 'to'.
     */
    function transfer(address to, uint256 amount)
        public
        virtual
        override
        includedManager(MANAGER_ROLE, to)
        returns (bool)
    {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `amount`.
     * - the caller must have allowance for ``from``'s tokens of at least `amount`.
     * - the manager must be included in the 'from' or 'to'.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override includedManager(MANAGER_ROLE, to) returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - the manager must be included in the 'caller' or 'sender'.
     */
    function approve(address spender, uint256 amount)
        public
        virtual
        override
        includedManager(MANAGER_ROLE, spender)
        returns (bool)
    {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }
}
