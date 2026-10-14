// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ACM-COIN
/// @notice ERC-20 do ACM Student Chapter da FEUP, com teto de emissão, inflação anual
///         emitida pelo dono para o tesouro e uma taxa por transferência paga a mais por quem envia.
contract Moeda is ERC20, Ownable {
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;

    uint256 public immutable maxSupply;
    uint256 public immutable inflationBps;
    uint256 public immutable feeBps;
    address public treasury;
    uint256 public lastInflationMint;

    error AboveMaxSupply();
    error FeeTooHigh();
    error ZeroTreasury();

    event TreasuryChanged(address indexed treasury);
    event InflationMinted(address indexed treasury, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 maxSupply_,
        uint256 inflationBps_,
        uint256 feeBps_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (feeBps_ > 1_000) revert FeeTooHigh();
        if (initialSupply > maxSupply_) revert AboveMaxSupply();
        maxSupply = maxSupply_;
        inflationBps = inflationBps_;
        feeBps = feeBps_;
        treasury = msg.sender;
        lastInflationMint = block.timestamp;
        _mint(msg.sender, initialSupply);
    }

    /// @notice Taxa cobrada a mais sobre `amount`, arredondada para cima.
    function feeFor(uint256 amount) public view returns (uint256) {
        return (amount * feeBps + BPS - 1) / BPS;
    }

    /// @notice Inflação acumulada desde a última emissão, proporcional ao tempo e limitada ao máximo.
    function pendingInflation() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastInflationMint;
        uint256 supply = totalSupply();
        uint256 amount = (supply * inflationBps * elapsed) / (BPS * YEAR);
        if (supply + amount > maxSupply) amount = maxSupply - supply;
        return amount;
    }

    function mintInflation() external onlyOwner returns (uint256 amount) {
        amount = pendingInflation();
        lastInflationMint = block.timestamp;
        if (amount > 0) {
            _mint(treasury, amount);
            emit InflationMinted(treasury, amount);
        }
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroTreasury();
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) && totalSupply() + value > maxSupply) revert AboveMaxSupply();
        if (from != address(0) && to != address(0) && feeBps != 0 && from != treasury) {
            super._update(from, treasury, feeFor(value));
        }
        super._update(from, to, value);
    }
}
