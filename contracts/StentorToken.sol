pragma solidity ^0.4.15;

import "zeppelin/contracts/token/StandardToken.sol";
import "zeppelin/contracts/token/BurnableToken.sol";

/**
 * @title StentorToken
 * @dev ERC20 Token
 * It is meant to be used in a crowdsale contract.
 */
contract StentorToken is StandardToken, BurnableToken {

    string public constant name = "Stentor Game Token";
    string public constant symbol = "SGT";
    uint8 public constant decimals = 18;

    function StentorToken(uint256 _initialAmount) {
        balances[msg.sender] = _initialAmount;
        totalSupply = _initialAmount;
    }
}
