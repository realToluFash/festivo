import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { logo } from '../theme/logo.ts';
import { tokens } from '../theme/tokens.ts';
import { type BrandSize, brandSize } from './brandSize.ts';

function Word({ ink }: { ink: string }) {
  return <Path d={logo.wordmark.d} fill={ink} />;
}

function SymbolShapes({ ink }: { ink: string }) {
  return (
    <>
      {logo.symbol.paths.map((d) => (
        <Path key={d} d={d} fill={ink} />
      ))}
    </>
  );
}

/** A fixed size, which a text-size change leaves as it is. The drawing is hidden: the view is read as the name. */
export function Brand({
  lockup = false,
  header = false,
  ink = tokens.colorInk,
  testID,
  ...size
}: BrandSize & {
  lockup?: boolean;
  header?: boolean;
  /** White on a cover; ink everywhere else. */
  ink?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const box = lockup ? logo.lockup.viewBox : logo.wordmark.viewBox;
  const { width, height } = brandSize(lockup, size);
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
            <G transform={`scale(${symbol.scale})`}>
              <SymbolShapes ink={ink} />
            </G>
            <G transform={`translate(${word.x} ${word.y}) scale(${word.scale})`}>
              <Word ink={ink} />
            </G>
          </>
        ) : (
          <Word ink={ink} />
        )}
      </Svg>
    </View>
  );
}
