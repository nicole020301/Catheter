import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
  plugins:[basicSsl(
    
  )]
});