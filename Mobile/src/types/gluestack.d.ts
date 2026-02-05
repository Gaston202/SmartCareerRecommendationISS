import '@gluestack-ui/themed';
import type { ViewProps, TextProps, PressableProps } from 'react-native';
export { config } from '@gluestack-ui/config';

/**
 * Gluestack styled component props type augmentation
 * Allows theme token strings like "$white", "$primary600", "$2xl", etc.
 */
declare module '@gluestack-ui/themed' {
  interface StyledComponentPropsInterface {
    // Layout
    flex?: number | string;
    w?: string | number;
    h?: string | number;
    width?: string | number;
    height?: string | number;

    // Spacing
    p?: string | number;
    px?: string | number;
    py?: string | number;
    pb?: string | number;
    pt?: string | number;
    pl?: string | number;
    pr?: string | number;
    m?: string | number;
    mx?: string | number;
    my?: string | number;
    mb?: string | number;
    mt?: string | number;
    ml?: string | number;
    mr?: string | number;

    // Colors
    bg?: string;
    backgroundColor?: string;
    color?: string;
    borderColor?: string;

    // Typography
    fontSize?: string | number;
    fontWeight?: string | number;
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';

    // Flexbox
    space?: string;
    gap?: string | number;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    justifyContent?:
      | 'flex-start'
      | 'flex-end'
      | 'center'
      | 'space-between'
      | 'space-around'
      | 'space-evenly';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';

    // Border
    rounded?: string | number;
    borderRadius?: string | number;

    // Opacity
    opacity?: number;

    // Variant
    variant?: string;
  }

  // Augment all styled components
  interface VStackProps extends StyledComponentPropsInterface {}
  interface HStackProps extends StyledComponentPropsInterface {}
  interface CenterProps extends StyledComponentPropsInterface {}
  interface TextProps extends StyledComponentPropsInterface {}
  interface ButtonProps extends StyledComponentPropsInterface {}
  interface InputProps extends StyledComponentPropsInterface {}
  interface FormControlProps extends StyledComponentPropsInterface {}
  interface FormControlLabelProps extends StyledComponentPropsInterface {}
}

