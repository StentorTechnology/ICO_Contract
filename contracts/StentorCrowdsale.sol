pragma solidity ^0.4.15;

import "zeppelin/contracts/math/SafeMath.sol";
import "zeppelin/contracts/lifecycle/Pausable.sol";
import "zeppelin/contracts/crowdsale/RefundVault.sol";
import "./StentorToken.sol";


/**
 * @title Eliptic curve signature operations
 *
 * @dev Based on https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d
 */

library ECRecovery {

    /**
     * @dev Recover signer address from a message by using his signature
     * @param hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
     * @param sig bytes signature, the signature is generated using web3.eth.sign()
     */
    function recover(bytes32 hash, bytes sig) public constant returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        //Check the signature length
        if (sig.length != 65) {
            return (address(0));
        }

        // Divide the signature in r, s and v variables
        assembly {
        r := mload(add(sig, 32))
        s := mload(add(sig, 64))
        v := byte(0, mload(add(sig, 96)))
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
            return (address(0));
        } else {
            return ecrecover(hash, v, r, s);
        }
    }

}


/**
 * @title StentorCrowdsale
 */

contract StentorCrowdsale is Pausable {

    using SafeMath for uint256;

    //Token being sold
    StentorToken public token;

    // start and end timestamps where investments are allowed (both inclusive)
    uint256 public startTime;
    uint256 public endTime;

    // refund vault used to hold funds while crowdsale is running
    RefundVault public vault;

    // how many token units a buyer gets per wei
    uint256 public rate;

    // amount of raised money in wei
    uint256 public weiRaised;

    //minimum amount of wei to raise
    uint256 public goal;

    //hard cap in wei
    uint256 public cap;

    uint256 public individualCap;

    bool public isFinalized = false;
    uint256 public finalizedTime = 0;

    //the amount each approved contributor has made
    mapping (address => uint256) public contributedAmount;

    //the signer that approves all contributions server-side
    address public signer;

    event ApprovedContributor(address contributor);
    event RemovedContributor(address contributor);

    event Finalized();

    /**
     * event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokenPurchase(address indexed purchaser, uint256 value, uint256 amount);


    function StentorCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _goal, uint256 _cap, uint256 _individualCap, address _vault, address _token, address _signer) {

        require(_startTime >= getTime());
        require(_endTime >= _startTime);
        require(_rate > 0);
        require(_goal > 0);
        require(_cap > 0);
        require(_cap > _goal);
        require(_individualCap > 0);
        require(_vault != 0x0);
        require(_token != 0x0);
        require(_signer != 0x0);

        startTime = _startTime;
        endTime = _endTime;
        rate = _rate;
        goal = _goal;
        cap = _cap;
        individualCap = _individualCap;
        vault = RefundVault(_vault);
        token = StentorToken(_token);
        signer = _signer;
    }

    // reject default transaction since we require a signature
    function() payable {
        revert();
    }

    // low level token purchase function
    function buyTokens(bytes signature) whenNotPaused public payable {
        require(validSignature(signature));
        require(validPurchase());

        uint256 weiAmount = msg.value;

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        // update state
        weiRaised = weiRaised.add(weiAmount);

        contributedAmount[msg.sender] = contributedAmount[msg.sender].add(weiAmount);

        token.transfer(msg.sender, tokens);
        TokenPurchase(msg.sender, weiAmount, tokens);

        forwardFunds();
    }

    // In addition to sending the funds, we want to call
    // the RefundVault deposit function
    function forwardFunds() internal {
        vault.deposit.value(msg.value)(msg.sender);
    }

    // @return true if the transaction can buy tokens
    function validPurchase() internal constant returns (bool) {
        bool withinPeriod = getTime() >= startTime && getTime() <= endTime;
        bool nonZeroPurchase = msg.value != 0;
        bool withinCap = weiRaised.add(msg.value) <= cap;
        bool individualCapReached = contributedAmount[msg.sender].add(msg.value) > individualCap;
        return !individualCapReached && withinCap && withinPeriod && nonZeroPurchase;
    }

    // @return true if the server signed off on msg.sender, thus allowing them to contribute
    function validSignature(bytes signature) internal constant returns (bool) {
        return(ECRecovery.recover(sha3(msg.sender), signature) == signer);
    }

    // @return true if crowdsale event has ended
    function hasEnded() public constant returns (bool) {
        bool capReached = weiRaised >= cap;
        return capReached || getTime() > endTime;
    }

    // if crowdsale is unsuccessful, investors can claim refunds here
    function claimRefund() whenNotPaused public {
        require(isFinalized);
        require(!goalReached());

        vault.refund(msg.sender);
    }

    /**
     * @dev Must be called after crowdsale ends, to do some extra finalization
     * work. Calls the contract's finalization function.
     */
    function finalize() whenNotPaused onlyOwner public {
        require(!isFinalized);
        require(hasEnded());

        finalization();
        Finalized();

        isFinalized = true;
        finalizedTime = getTime();
    }

    // vault finalization task, called when owner calls finalize()
    function finalization() whenNotPaused internal {
        if (goalReached()) {
            vault.close();
        }
        else {
            vault.enableRefunds();
        }
    }

    function goalReached() public constant returns (bool) {
        return weiRaised >= goal;
    }

    //returns the current time, overridden in mock files for testing purposes
    function getTime() internal returns (uint) {
        return now;
    }
}
