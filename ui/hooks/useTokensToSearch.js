import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import contractMap from '@metamask/contract-metadata';
import BigNumber from 'bignumber.js';
import { isEqual, shuffle, uniqBy } from 'lodash';
import { getTokenFiatAmount } from '../helpers/utils/token-util';
import {
  getTokenExchangeRates,
  getCurrentCurrency,
  getSwapsDefaultToken,
  getCurrentChainId,
  getUseTokenDetection,
  getTokenList,
} from '../selectors';
import { getConversionRate } from '../ducks/metamask/metamask';

import { getSwapsTokens } from '../ducks/swaps/swaps';
import { isSwapsDefaultTokenSymbol } from '../../shared/modules/swaps.utils';
import { toChecksumHexAddress } from '../../shared/modules/hexstring-utils';
import { useEqualityCheck } from './useEqualityCheck';

const shuffledContractMap = shuffle(
  Object.entries(contractMap)
    .map(([address, tokenData]) => ({
      ...tokenData,
      address: address.toLowerCase(),
    }))
    .filter((tokenData) => Boolean(tokenData.erc20)),
);

export function getRenderableTokenData(
  token,
  contractExchangeRates,
  conversionRate,
  currentCurrency,
  chainId,
  tokenList,
  useTokenDetection,
) {
  const { symbol, name, address, iconUrl, string, balance, decimals } = token;
  // token from dynamic api list is fetched when useTokenDetection is true
  // And since the token.address from allTokens is checksumaddress
  // token Address have to be changed to lowercase when we are using dynamic list
  const tokenAddress = useTokenDetection ? address?.toLowerCase() : address;
  const formattedFiat =
    getTokenFiatAmount(
      isSwapsDefaultTokenSymbol(symbol, chainId)
        ? 1
        : contractExchangeRates[toChecksumHexAddress(address)],
      conversionRate,
      currentCurrency,
      string,
      symbol,
      true,
    ) || '';
  const rawFiat =
    getTokenFiatAmount(
      isSwapsDefaultTokenSymbol(symbol, chainId)
        ? 1
        : contractExchangeRates[toChecksumHexAddress(address)],
      conversionRate,
      currentCurrency,
      string,
      symbol,
      false,
    ) || '';
  const usedIconUrl =
    iconUrl ||
    (tokenList[tokenAddress] &&
      `images/contract/${tokenList[tokenAddress].iconUrl}`) ||
    token?.image;
  return {
    ...token,
    primaryLabel: symbol,
    secondaryLabel: name || tokenList[tokenAddress]?.name,
    rightPrimaryLabel:
      string && `${new BigNumber(string).round(6).toString()} ${symbol}`,
    rightSecondaryLabel: formattedFiat,
    iconUrl: usedIconUrl,
    identiconAddress: usedIconUrl ? null : address,
    balance,
    decimals,
    name: name || tokenList[tokenAddress]?.name,
    rawFiat,
  };
}

export function useTokensToSearch({
  usersTokens = [],
  topTokens = {},
  shuffledTokensList,
}) {
  const chainId = useSelector(getCurrentChainId);
  const tokenConversionRates = useSelector(getTokenExchangeRates, isEqual);
  const conversionRate = useSelector(getConversionRate);
  const currentCurrency = useSelector(getCurrentCurrency);
  const defaultSwapsToken = useSelector(getSwapsDefaultToken);
  const tokenList = useSelector(getTokenList);
  const useTokenDetection = useSelector(getUseTokenDetection);
  // token from dynamic api list is fetched when useTokenDetection is true
  const shuffledTokenList = useTokenDetection
    ? shuffledTokensList
    : shuffledContractMap;
  const memoizedTopTokens = useEqualityCheck(topTokens);
  const memoizedUsersToken = useEqualityCheck(usersTokens);

  const defaultToken = getRenderableTokenData(
    defaultSwapsToken,
    tokenConversionRates,
    conversionRate,
    currentCurrency,
    chainId,
    tokenList,
    useTokenDetection,
  );
  const memoizedDefaultToken = useEqualityCheck(defaultToken);

  const swapsTokens = useSelector(getSwapsTokens) || [];

  const tokensToSearch = swapsTokens.length
    ? swapsTokens
    : [
        memoizedDefaultToken,
        ...shuffledTokenList.filter(
          (token) => token.symbol !== memoizedDefaultToken.symbol,
        ),
      ];

  const memoizedTokensToSearch = useEqualityCheck(tokensToSearch);
  return useMemo(() => {
    const usersTokensAddressMap = memoizedUsersToken.reduce(
      (acc, token) => ({ ...acc, [token.address.toLowerCase()]: token }),
      {},
    );

    const tokensToSearchBuckets = {
      owned: [],
      top: [],
      others: [],
    };

    const memoizedSwapsAndUserTokensWithoutDuplicities = uniqBy(
      [memoizedDefaultToken, ...memoizedTokensToSearch, ...memoizedUsersToken],
      (token) => token.address.toLowerCase(),
    );

    memoizedSwapsAndUserTokensWithoutDuplicities.forEach((token) => {
      const renderableDataToken = getRenderableTokenData(
        { ...usersTokensAddressMap[token.address.toLowerCase()], ...token },
        tokenConversionRates,
        conversionRate,
        currentCurrency,
        chainId,
        tokenList,
        useTokenDetection,
      );
      if (memoizedTopTokens[token.address.toLowerCase()]) {
        tokensToSearchBuckets.top[
          memoizedTopTokens[token.address.toLowerCase()].index
        ] = renderableDataToken;
      } else if (
        isSwapsDefaultTokenSymbol(renderableDataToken.symbol, chainId) ||
        usersTokensAddressMap[token.address.toLowerCase()]
      ) {
        tokensToSearchBuckets.owned.push(renderableDataToken);
      } else {
        tokensToSearchBuckets.others.push(renderableDataToken);
      }
    });

    tokensToSearchBuckets.owned = tokensToSearchBuckets.owned.sort(
      ({ rawFiat }, { rawFiat: secondRawFiat }) => {
        return new BigNumber(rawFiat || 0).gt(secondRawFiat || 0) ? -1 : 1;
      },
    );
    tokensToSearchBuckets.top = tokensToSearchBuckets.top.filter(Boolean);
    return [
      ...tokensToSearchBuckets.owned,
      ...tokensToSearchBuckets.top,
      ...tokensToSearchBuckets.others,
    ];
  }, [
    memoizedTokensToSearch,
    memoizedUsersToken,
    tokenConversionRates,
    conversionRate,
    currentCurrency,
    memoizedTopTokens,
    memoizedDefaultToken,
    chainId,
    tokenList,
    useTokenDetection,
  ]);
}
