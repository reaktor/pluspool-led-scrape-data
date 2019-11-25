module.exports = {
  env: {
    commonjs: true,
    es6: true,
    node: true
  },
  extends: [
    'standard'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  rules: 
    {    
      // react/jsx-filename-extension: [1, { "extensions": [".js", ".jsx"] }],
      implicit-arrow-linebreak: "off",    
      comma-dangle: "off",    
      indent: "off",    
      no-trailing-spaces: "off"  
    }
}
