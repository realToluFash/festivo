import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { logo } from '../theme/logo.ts';
import { tokens } from '../theme/tokens.ts';

function Word() {
  const { parts, dot } = logo.wordmark;

  return (
    <>
      {parts.map((part) => (
        <Path key={part.letter} d={part.d} fill={tokens[part.token]} />
      ))}
      <Circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={tokens[dot.token]} />
    </>
  );
}

/** A fixed size, which a text-size change leaves as it is. The drawing is hidden: the view is read as the name. */
export function Brand({
  width,
  lockup = false,
  header = false,
  testID,
}: {
  width: number;
  lockup?: boolean;
  header?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const box = lockup ? logo.lockup.viewBox : logo.wordmark.viewBox;
  const height = (width * box.height) / box.width;
  const { symbol, word } = logo.lockup;

  return (
    <View
      accessible
      accessibilityLabel={t('app.name')}
      accessibilityRole={header ? 'header' : undefined}
      style={{ width, height }}
      testID={testID}
    >
      <Svg
        width={width}
        height={height}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {lockup ? (
          <>
            <G transform={`translate(${symbol.x} ${symbol.y}) scale(${symbol.scale})`}>
              {symbol.dots.map((dot) => (
                <Circle
                  key={dot.token}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={dot.r}
                  fill={tokens[dot.token]}
                />
              ))}
            </G>
            <G transform={`translate(${word.x} 0)`}>
              <Word />
            </G>
          </>
        ) : (
          <Word />
        )}
      </Svg>
    </View>
  );
}
