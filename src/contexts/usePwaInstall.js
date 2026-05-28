import { useContext } from 'react';
import { PwaInstallContext } from './PwaInstallContextObject';

export const usePwaInstall = () => useContext(PwaInstallContext);
