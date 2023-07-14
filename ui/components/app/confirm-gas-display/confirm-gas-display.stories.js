import React from 'react';
import ConfirmGasDisplay from './confirm-gas-display';

export default {
  title: 'Components/App/ConfirmGasDisplay',
  component: ConfirmGasDisplay,
  argTypes: {
    userAcknowledgedGasMissing: {
      control: 'boolean',
    },
  },
  args: {
    userAcknowledgedGasMissing: true,
  },
};

export const DefaultStory = (args) => <ConfirmGasDisplay {...args} />;

DefaultStory.storyName = 'Default';
