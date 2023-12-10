// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Marketplace is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    struct Bid {
        address bidder;
        uint256 amount;
    }

    struct Listing {
        address nftAddress;
        uint256 tokenId;
        address nftOwner;
        uint256 price;
        address soldTo;
        uint256 minPrice;
        uint256 reservePrice;
        uint256 highestBid;
        address highestBidder;
        uint256 expirationTimestamp;
        bool isAuction;
    }

    address public WETH;

    uint256 public numberOfListings;
    mapping(uint256 => Listing) public listings;

    // nftaddress to tokenid to auctionexpiry
    mapping(address => mapping(uint256 => uint256)) public auctionExpiry;
    // nftaddress to tokenId to bidders
    mapping(address => mapping(uint256 => Bid[])) public bidders;
    // nftaddress to tokenId to bool.
    mapping(address => mapping(uint256 => bool)) public isActive;

    event NftListed(
        uint256 indexed listingId,
        address indexed nftAddress,
        uint256 nftTokenId,
        bool isAuction
    );

    event NftPurchased(
        uint256 indexed listingId,
        address indexed nftAddress,
        uint256 nftTokenId,
        uint256 price,
        bool isAuction
    );

    event BidPlaced(
        uint256 indexed ListingId,
        address indexed bidder,
        uint256 bidPrice
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address defaultAdmin,
        address WETHAddress
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        WETH = WETHAddress;
    }

    function listNft(
        address nftAddress,
        uint256 tokenId,
        uint256 price,
        bool isAuction,
        uint256 minPrice,
        uint256 reservePrice,
        uint256 timePeriod
    ) external returns (uint256) {
        require(
            !isActive[nftAddress][tokenId],
            "Cannot list the same nft twice"
        );
        require(
            IERC721(nftAddress).ownerOf(tokenId) == msg.sender,
            "You do not own this NFT"
        );
        require(
            IERC721(nftAddress).getApproved(tokenId) == address(this),
            "Token Id not approved to the marketplace"
        );
        Listing storage nft = listings[numberOfListings];
        nft.nftAddress = nftAddress;
        nft.tokenId = tokenId;
        nft.nftOwner = msg.sender;
        isActive[nftAddress][tokenId] = true;
        if (isAuction) {
            auctionListing(nft, minPrice, reservePrice, timePeriod);
        } else {
            require(price > 0, "price should be greater than 0");
            nft.price = price;
        }

        emit NftListed(numberOfListings, nftAddress, tokenId, isAuction);
        numberOfListings = numberOfListings + 1;
        return numberOfListings;
    }

    function auctionListing(
        Listing storage nft,
        uint256 minPrice,
        uint256 reservePrice,
        uint256 timePeriod
    ) private {
        require(reservePrice > 0, "Reserve price should be greater than 0");
        require(timePeriod > 0, "Time period should be greater than 0");
        nft.isAuction = true;
        nft.minPrice = minPrice;
        nft.reservePrice = reservePrice;
        nft.expirationTimestamp = block.timestamp + timePeriod;
        auctionExpiry[nft.nftAddress][nft.tokenId] = nft.expirationTimestamp;
    }

    function buyFixedPriceNft(uint256 listingId) external payable {
        Listing storage nft = listings[listingId];
        require(
            isActive[nft.nftAddress][nft.tokenId],
            "This listing is not active or already sold"
        );
        require(!nft.isAuction, "Cannot buy NFT that is placed for auction");
        require(msg.value >= nft.price, "Insufficient ETH");
        if (IERC721(nft.nftAddress).ownerOf(nft.tokenId) == nft.nftOwner) {
            (bool success, ) = nft.nftOwner.call{value: msg.value}("");
            require(success, "Failed to send ETH");
            IERC721(nft.nftAddress).transferFrom(
                nft.nftOwner,
                msg.sender,
                nft.tokenId
            );
            nft.soldTo = msg.sender;
            emit NftPurchased(
                listingId,
                nft.nftAddress,
                nft.tokenId,
                msg.value,
                nft.isAuction
            );
        }
        isActive[nft.nftAddress][nft.tokenId] = false;
    }

    // Use WETH to bid
    // Call approve
    function bid(uint256 listingId, uint256 bidPrice) external {
        Listing storage nft = listings[listingId];
        require(
            bidPrice > nft.minPrice,
            "Bid is lower than the minimum price set by the owner"
        );
        require(nft.isAuction, "Cannot bid on this NFT");
        require(block.timestamp <= nft.expirationTimestamp, "Auction is Over!");
        require(
            bidPrice > nft.highestBid,
            "Bid is lower than the current highest Bid"
        );
        require(
            IERC20(WETH).balanceOf(msg.sender) >= bidPrice,
            "You do not have enough WETH to bid"
        );
        require(
            IERC20(WETH).allowance(msg.sender, address(this)) >= bidPrice,
            "No approval given for marketplace"
        );
        nft.highestBid = bidPrice;
        nft.highestBidder = msg.sender;
        bidders[nft.nftAddress][nft.tokenId].push(
            Bid({bidder: msg.sender, amount: bidPrice})
        );
        emit BidPlaced(listingId, msg.sender, bidPrice);
    }

    // accepts the bid and transfers nft and WETH
    function endAuction(uint256 listingId) external {
        Listing storage nft = listings[listingId];
        require(
            isActive[nft.nftAddress][nft.tokenId],
            "This listing is not active"
        );
        require(nft.isAuction, "No Auction for this NFT");
        require(
            block.timestamp > nft.expirationTimestamp,
            "Auction is NOT Over!"
        );
        if (
            IERC721(nft.nftAddress).ownerOf(nft.tokenId) == nft.nftOwner &&
            IERC20(WETH).balanceOf(nft.highestBidder) >= nft.highestBid
        ) {
            if (nft.highestBid >= nft.reservePrice) {
                IERC20(WETH).transferFrom(
                    nft.highestBidder,
                    nft.nftOwner,
                    nft.highestBid
                );
                IERC721(nft.nftAddress).transferFrom(
                    nft.nftOwner,
                    nft.highestBidder,
                    nft.tokenId
                );
                nft.soldTo = nft.highestBidder;
                delete bidders[nft.nftAddress][nft.tokenId];
                emit NftPurchased(
                    listingId,
                    nft.nftAddress,
                    nft.tokenId,
                    nft.highestBid,
                    nft.isAuction
                );
            }
        }
        isActive[nft.nftAddress][nft.tokenId] = false;
    }

    function getFixedPriceNfts()
        external
        view
        returns (Listing[] memory fixedListOfNfts)
    {
        uint256 fixedCount = 0;

        for (uint256 i = 0; i < numberOfListings; i++) {
            if (!listings[i].isAuction) {
                fixedCount++;
            }
        }

        fixedListOfNfts = new Listing[](fixedCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < numberOfListings; i++) {
            if (!listings[i].isAuction) {
                fixedListOfNfts[currentIndex] = listings[i];
                currentIndex++;
            }
        }
    }

    function getAuctionedNfts()
        external
        view
        returns (Listing[] memory AuctionedNfts)
    {
        uint256 fixedCount = 0;

        for (uint256 i = 0; i < numberOfListings; i++) {
            if (listings[i].isAuction) {
                fixedCount++;
            }
        }

        AuctionedNfts = new Listing[](fixedCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < numberOfListings; i++) {
            if (listings[i].isAuction) {
                AuctionedNfts[currentIndex] = listings[i];
                currentIndex++;
            }
        }
    }

    function getAuctionEndTime(
        address nftAddress,
        uint256 nftTokenId
    ) external view returns (uint256) {
        return auctionExpiry[nftAddress][nftTokenId];
    }

    function getBidders(
        address nftAddress,
        uint256 nftTokenId
    ) external view returns (Bid[] memory) {
        return bidders[nftAddress][nftTokenId];
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
