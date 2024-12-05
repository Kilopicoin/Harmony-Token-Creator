// App.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getContract, getSignerContract } from './contract';
import './App.css'; // CSS dosyasını import edin
import { FaSun, FaMoon, FaCopy, FaPlusCircle, FaSpinner } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


function App() {
  const [account, setAccount] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    decimals: '',
    website: ''
  });
  const [allTokens, setAllTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Token oluşturma yükleme durumu
  const [activeMenu, setActiveMenu] = useState('create'); // Menü durumu
  const [listInAllTokens, setListInAllTokens] = useState(true); // Checkbox durumu
  const [theme, setTheme] = useState('dark'); // Tema durumu

  // Sayfalama için yeni state değişkenleri
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 10; // Her sayfada gösterilecek token sayısı

  const RPC = 'https://api.harmony.one'; // Harmony RPC URL'si
  const correctChainId = parseInt('0x63564c40', 16);


  // Cüzdanı bağlama fonksiyonu
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // MetaMask'ı etkinleştir
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);

        toast.success('Wallet Connected!');
      } catch (error) {
        console.error(error);
        toast.error('Error, Wallet NOT Connected');
      }
    } else {
      toast.error('Please install Metamask');
    }
  };


  useEffect(() => {
    const handleAccountChange = (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        toast.info('Wallet account changed!');
      } else {
        setAccount('');
        toast.warn('Wallet disconnected');
      }
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountChange);

      // Cleanup on component unmount
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountChange);
      };
    }
  }, []);


  useEffect(() => {
    const checkConnectedWallet = async () => {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
        }
      }
    };
    checkConnectedWallet();
  }, []);

  // Form alanlarındaki değişiklikleri yakalama fonksiyonu
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'listInAllTokens') {
        setListInAllTokens(checked);
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Tema değiştirme fonksiyonu
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };


  const checkNetwork = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();



      if (Number(network.chainId) !== correctChainId) {
        toast.warning('Please connect to the correct chain with Metamask.');
        return false;
      }
      return true;
    }
    return false;
  };

  // Token oluşturma fonksiyonu
  const createToken = async () => {
    const isCorrectNetwork = await checkNetwork();
    if (!isCorrectNetwork) return;

    try {
      const { name, symbol, totalSupply, decimals, website } = formData;

      if (name.length < 5 || name.length > 20) {
        toast.warning('Name is too short or too long');
        return;
      }

      if (symbol.length < 3 || symbol.length > 5) {
        toast.warning('Symbol is too short or too long');
        return;
      }

      const totalSupplyNumberX = parseInt(totalSupply);
    if (totalSupplyNumberX < 100000 || totalSupplyNumberX > 100000000000) {
      toast.warning('Total Supply is too low or too high');
      return;
    }


    const decimalsY = parseInt(decimals);
    if (decimalsY < 2 || decimalsY > 18) {
      toast.warning('Decimals is too low or too high');
      return;
    }

    if (website.length > 50) {
      toast.warning('Website Address is too long');
      return;
    }

  
      if (!name || !symbol || !totalSupply || !decimals) {
        toast.error('Please Fill All Fields');
        return;
      }
  
      const decimalsNumber = parseInt(decimals);
      const totalSupplyNumber = parseInt(totalSupply);
  
      const contract = await getSignerContract();
      setIsLoading(true);

      const creationFee = ethers.parseEther("970");
  
      const tx = await contract.createToken(
        name,
        symbol,
        totalSupplyNumber,
        decimalsNumber,
        website,
        listInAllTokens,
        { value: creationFee }
      );
  
      const receipt = await tx.wait();
      const tokenCreatedEvent = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .find((event) => event && event.name === 'TokenCreated');
  
      if (tokenCreatedEvent) {
        const newTokenAddress = tokenCreatedEvent.args.tokenAddress;
        setTokenAddress(newTokenAddress);
        toast.success(`Token has been created! Address: ${newTokenAddress}`);
      } else {
        toast.error('Token created but could not retrieve the address.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error, token not created');
    } finally {
      setIsLoading(false);
    }
  };
  

  // Tüm Tokenleri Çekmek İçin Fonksiyon
  const fetchAllTokens = async () => {
    setLoadingTokens(true);
    try {
      const contract = await getContract(); // Read-only contract instance
      const listedTokenAddresses = await contract.getListedTokens();
  
      const ERC20ABI = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function website() view returns (string)"
      ];
  
      const provider = new ethers.JsonRpcProvider(RPC);
  
      const tokenPromises = listedTokenAddresses.map(async (addr) => {
        try {
          const tokenContract = new ethers.Contract(addr, ERC20ABI, provider);
          const name = await tokenContract.name();
          const symbol = await tokenContract.symbol();
          const decimals = await tokenContract.decimals();
          const totalSupply = await tokenContract.totalSupply();
          const formattedTotalSupply = new Intl.NumberFormat('en-US').format(Number(ethers.formatUnits(totalSupply, decimals)));
          const website = await tokenContract.website();
          return {
            address: addr,
            name,
            symbol,
            decimals: decimals.toString(),
            formattedTotalSupply,
            website
          };
        } catch (error) {
          console.error(`Error fetching token ${addr}:`, error);
          return null;
        }
      });
  
      const results = await Promise.allSettled(tokenPromises);
      const tokens = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
      
      setAllTokens([...tokens].reverse());
    } catch (error) {
      console.error(error);
      toast.error('Error fetching tokens');
    }
    setLoadingTokens(false);
  };
  

  // useEffect ile uygulama yüklendiğinde tokenleri çek ve tema kontrolü
  useEffect(() => {
    // Tema kontrolü
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }

  }, []);


  // Menü seçimini değiştirme fonksiyonu
  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
    setCurrentPage(1); // Menü değiştiğinde sayfayı sıfırla

    if (menu === 'list') {
      fetchAllTokens();
    }


  };

  // Sayfalama hesaplamaları
  const indexOfLastToken = currentPage * tokensPerPage;
  const indexOfFirstToken = indexOfLastToken - tokensPerPage;
  const currentTokens = allTokens.slice(indexOfFirstToken, indexOfLastToken);
  const totalPages = Math.ceil(allTokens.length / tokensPerPage);

  // Sayfa numarasını değiştirme fonksiyonu
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className={`App ${theme}`}>
      <div className="sidebar">
        <ul>
          <li
            className={activeMenu === 'create' ? 'active' : ''}
            onClick={() => handleMenuClick('create')}
          >
            <FaPlusCircle /> Token Creation
          </li>
          <li
            className={activeMenu === 'list' ? 'active' : ''}
            onClick={() => handleMenuClick('list')}
          >
            <FaCopy /> Token List
          </li>
        </ul>
        <button className="theme-toggle-button" onClick={toggleTheme}>
          {theme === 'light' ? <FaMoon /> : <FaSun />} {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>

      <div className="main-content">
      <header className="header">
  <div className="title-container">
    <h1>Forge, Harmony Token Creation Tool</h1>
    <a href="https://kilopi.net" target="_blank" rel="noopener noreferrer" className="kilopi-link">
      by Kilopi.net
    </a>
  </div>
</header>


        {activeMenu === 'create' && (
          <section className="create-section">
            <div className="create-container">
              <div className="form-container">
                <h2>Token Creation</h2>
                <form onSubmit={(e) => { e.preventDefault(); createToken(); }}>
                  <div className="form-group">
             
                    <input
                      type="text"
                      name="name"
                      placeholder="Token Name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
            
                    <input
                      type="text"
                      name="symbol"
                      placeholder="Token Symbol"
                      value={formData.symbol}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
            
                    <input
                      type="text"
                      name="totalSupply"
                      placeholder="Total Supply"
                      value={formData.totalSupply}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
            
                    <input
                      type="text"
                      name="decimals"
                      placeholder="Decimals"
                      value={formData.decimals}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
           
                    <input
                      type="url"
                      name="website"
                      placeholder="Web Address (Optional)"
                      value={formData.website}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group checkbox-group">
                    <input
                      type="checkbox"
                      name="listInAllTokens"
                      checked={listInAllTokens}
                      onChange={handleChange}
                    />
                    <label>Add to "Token List" on the Left Menu</label>
                  </div>
                  <button
  type="button"
  className="submit-button"
  disabled={isLoading}
  onClick={async () => {
    if (!account) {
      await connectWallet(); // First connect the wallet
    }
    if (account) {
      createToken(); // Call createToken if wallet is connected
    }
  }}
>
  {isLoading ? (
    <><FaSpinner className="spinner" /> Creating Token...</>
  ) : !account ? (
    "Metamask Wallet NOT Connected"
  ) : (
    <><FaPlusCircle /> Create Token ( Requires 1000 ONE )</>
  )}
</button>

{account && (
  <div className="connected-wallet">
    <p>Connected Wallet: {account}</p>
  </div>
)}

{tokenAddress && (
  <div className={`token-address ${listInAllTokens ? '' : 'hidden'}`}>
    <h3>{listInAllTokens ? 'Created Token Address:' : 'Created Token Address (Not Added to List):'}</h3>
    <p>{tokenAddress}</p>
    <button
  className="copy-button"
  onClick={(e) => {
    e.stopPropagation(); // Prevent event bubbling
    e.preventDefault(); // Prevent form submission
    navigator.clipboard.writeText(tokenAddress);
    toast.success('Address copied!');
  }}
>
  <FaCopy /> Copy
</button>

  </div>
)}

                </form>
              </div>

              <div className="instruction-table">
                <h2>Guide</h2>
                <table>
                 
                  <tbody>
                    <tr>
        
                      <td>This dApp works with <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer" className="link">Metamask Wallet</a></td>
                    </tr>
                    <tr>
         
                      <td>Optimum Token Name Length: 5 to 20 Letters, Example: Kilopi</td>
                    </tr>
                    <tr>
          
                      <td>Optimum Token Symbol Length: 3 to 5 Letters, Example: LOP</td>
                    </tr>
                    <tr>
            
                      <td>Optimum Token Supply: 100K to 100B, Example: 2000000000</td>
                    </tr>
                    <tr>
             
                      <td>Optimum Token Decimals: 2 to 18 Digits, Example: 6</td>
                    </tr>
                    <tr>
              
                      <td>Web Address is optional, can be empty or, Example: https://kilopi.net/</td>
                    </tr>
                    <tr>
      
                      <td>Adding to Token List is optional, if YES, your token will show up in the Token List at the Left Menu</td>
                    </tr>

                    <tr>
      
                      <td>Total Supply is fixed and new tokens can not be minted</td>
                    </tr>

                    <tr>
      
                      <td>There is no Freeze Authority. There is no Transaction Fee System. There is no Vesting System</td>
                    </tr>

               

                    <tr>
      
                      <td>This tool creates tokens compatible for explorers like Coingecko, Coinmarketcap, Dexscreener, DefiLama etc. without adding any confusing feature</td>
                    </tr>

                    <tr>
      
                      <td>Advanced features can be added to the tokens later on. If you need additional features, please contact info@kilopi.net</td>
                    </tr>

                    <tr>
        
        <td>This dApp is fully open source under <a href="https://github.com/orgs/Kilopicoin/repositories" target="_blank" rel="noopener noreferrer" className="link">Kilopi Repo</a></td>
      </tr>

      <tr>
      
      <td>It is highly recommended to watch the tutorial video</td>
    </tr>

    <tr>
        
        <td><a href="https://youtu.be/laMTRSxHGGg?si=tpekbXeVgST6DbCJ" target="_blank" rel="noopener noreferrer" className="link">Türkçe Anlatım Videosu</a></td>
      </tr>

      <tr>
        
        <td><a href="https://youtu.be/mWeYT9k733I?si=9BGJLgs-3FfdpdZR" target="_blank" rel="noopener noreferrer" className="link">English Tutorial Video</a></td>
      </tr>
      
                  </tbody>
                </table>
              </div>
            </div>

           
          </section>
        )}

        {activeMenu === 'list' && (
          <section className="list-section">
            <div className="all-tokens">
              <h2>Token List</h2>
              {loadingTokens ? (
                <p className="loading-text">Loading Tokens...</p>
              ) : allTokens.length > 0 ? (
                <>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Symbol</th>
                          <th>Total Supply</th>
                          <th>Decimals</th>
                          <th>Website <p>( Warning: Websites May be incorrect )</p></th>
                          <th>Address</th>
                      
                        </tr>
                      </thead>
                      <tbody>
                        {currentTokens.map((token, index) => (
                          <tr key={token.address}>
                            <td>{token.name}</td>
                            <td>{token.symbol}</td>
                            <td>{token.formattedTotalSupply}</td>
                            <td>{token.decimals}</td>
                            <td>
                              {token.website ? (
                                <a href={token.website} target="_blank" rel="noopener noreferrer">
                                  {token.website}
                                </a>
                              ) : (
                                'None'
                              )}
                            </td>
                            <td>{token.address}

                            <button
                                className="copy-button"
                                onClick={() => {
                                  navigator.clipboard.writeText(token.address);
                                  toast.success('Address copied!');
                                }}
                              >
                                <FaCopy /> Copy
                              </button>


                            </td>
                          
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Sayfalama Kontrolleri */}
                  <div className="pagination">
                    <button
                      className="page-button"
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => (
                      <button
                        key={index + 1}
                        className={`page-button ${currentPage === index + 1 ? 'active' : ''}`}
                        onClick={() => paginate(index + 1)}
                      >
                        {index + 1}
                      </button>
                    ))}
                    <button
                      className="page-button"
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <p className="no-tokens">Currently, Token List is empty.</p>
              )}
            </div>
          </section>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
    </div>


  );
}

export default App;
