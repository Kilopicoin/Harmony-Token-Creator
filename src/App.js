// App.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getContract, getSignerContract } from './contract';
import './App.css'; // CSS dosyasını import edin
import { FaSun, FaMoon, FaCopy, FaPlusCircle, FaSpinner } from 'react-icons/fa';

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
  const [theme, setTheme] = useState('light'); // Tema durumu

  // Sayfalama için yeni state değişkenleri
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 10; // Her sayfada gösterilecek token sayısı

  const RPC = 'https://api.s0.b.hmny.io'; // Harmony RPC URL'si

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

        alert('Cüzdan başarıyla bağlandı!');
      } catch (error) {
        console.error(error);
        alert('Cüzdan bağlanırken bir hata oluştu.');
      }
    } else {
      alert('Lütfen MetaMask veya başka bir Ethereum cüzdanı yükleyin.');
    }
  };

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

  // Token oluşturma fonksiyonu
  const createToken = async () => {
    try {
      const { name, symbol, totalSupply, decimals, website } = formData;

      // Girdi kontrolü
      if (!name || !symbol || !totalSupply || !decimals) {
        alert('Lütfen tüm gerekli alanları doldurun.');
        return;
      }

      // decimals ve totalSupply değerlerini doğru türlere dönüştürün
      const decimalsNumber = parseInt(decimals);
      if (isNaN(decimalsNumber)) {
        alert('Ondalık sayısı geçerli bir sayı olmalıdır.');
        return;
      }

      const totalSupplyNumber = parseInt(totalSupply);
      if (isNaN(totalSupplyNumber)) {
        alert('Toplam arz geçerli bir sayı olmalıdır.');
        return;
      }

      const contract = await getSignerContract();

      // İşlemi gönderme
      setIsLoading(true); // Yükleme başlatıldı
      const tx = await contract.createToken(
        name,
        symbol,
        totalSupplyNumber, // parseUnits kaldırıldı
        decimalsNumber,
        website
      );

      // İşlemin tamamlanmasını bekleme ve olayları alma
      const receipt = await tx.wait();

      // TokenCreated olayını bulma
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
        alert(`Token başarıyla oluşturuldu! Token Adresi: ${newTokenAddress}`);

        if (listInAllTokens) {
          // Yeni tokeni fetchAllTokens yerine direkt ekle
          await addTokenToList(newTokenAddress);
        } else {
          // Tokeni localStorage'da gizleme listesine ekle
          addHiddenToken(newTokenAddress);
        }
      } else {
        alert('Token oluşturuldu ancak adres alınamadı.');
      }
    } catch (error) {
      console.error(error);
      alert('Token oluşturulurken bir hata oluştu.');
    } finally {
      setIsLoading(false); // Yükleme sona erdi
    }
  };

  // Yeni tokeni listeye ekleme fonksiyonu
  const addTokenToList = async (tokenAddr) => {
    try {
      const ERC20ABI = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function website() view returns (string)"
      ];

      const provider = new ethers.JsonRpcProvider(RPC);
      const tokenContract = new ethers.Contract(tokenAddr, ERC20ABI, provider);
      const name = await tokenContract.name();
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();
      const totalSupply = await tokenContract.totalSupply();
      const website = await tokenContract.website();

      const newToken = {
        address: tokenAddr,
        name,
        symbol,
        decimals,
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        website
      };

      // Yeni tokeni listenin başına ekle
      setAllTokens((prevTokens) => [newToken, ...prevTokens]);
    } catch (error) {
      console.error(`Yeni tokeni çekerken bir hata oluştu:`, error);
      alert('Yeni tokeni listeye eklerken bir hata oluştu.');
    }
  };

  // Hidden Tokens listesini localStorage'a ekleme fonksiyonu
  const addHiddenToken = (tokenAddr) => {
    const hiddenTokens = JSON.parse(localStorage.getItem('hiddenTokens')) || [];
    if (!hiddenTokens.includes(tokenAddr)) {
      hiddenTokens.push(tokenAddr);
      localStorage.setItem('hiddenTokens', JSON.stringify(hiddenTokens));
    }
    // Tokeni listede göstermemek için state'i yeniden güncelle
    setAllTokens((prevTokens) => prevTokens.filter(token => token.address !== tokenAddr));
  };

  // Tüm Tokenleri Çekmek İçin Fonksiyon
  const fetchAllTokens = async () => {
    setLoadingTokens(true);
    try {
      const contract = await getContract(); // Read-only contract instance
      const allTokenAddresses = await contract.getDeployedTokens();

      // ERC20 ABI'yı tanımlayın (sadece gerekli fonksiyonlar)
      const ERC20ABI = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function website() view returns (string)"
      ];

      const provider = new ethers.JsonRpcProvider(RPC); // RPC URL'nizi ekleyin

      // Hidden Tokens listesini al
      const hiddenTokens = JSON.parse(localStorage.getItem('hiddenTokens')) || [];

      // Tüm tokenlerin detaylarını çekmek için Promise.allSettled kullanıyoruz
      const tokenPromises = allTokenAddresses
        .filter(addr => !hiddenTokens.includes(addr)) // Hidden tokens'ı filtrele
        .map(async (addr) => {
          try {
            const tokenContract = new ethers.Contract(addr, ERC20ABI, provider);
            const name = await tokenContract.name();
            const symbol = await tokenContract.symbol();
            const decimals = await tokenContract.decimals();
            const totalSupply = await tokenContract.totalSupply();
            const website = await tokenContract.website();
            return {
              address: addr,
              name,
              symbol,
              decimals,
              totalSupply: ethers.formatUnits(totalSupply, decimals),
              website
            };
          } catch (error) {
            console.error(`Token ${addr} çekerken bir hata oluştu:`, error);
            // Hatalı tokeni atlamak için null döndür
            return null;
          }
        });

      const results = await Promise.allSettled(tokenPromises);
      const tokens = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
      
      // Tokenleri tersine çevirerek en son oluşturulan tokenin başta olmasını sağla
      setAllTokens([...tokens].reverse());
    } catch (error) {
      console.error(error);
      alert('Tokenleri çekerken bir hata oluştu.');
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

  // useEffect ile hesap değiştiğinde tokenleri yeniden çek
  useEffect(() => {
    if (account) {
      fetchAllTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

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
        <h2>Menü</h2>
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
          {theme === 'light' ? <FaMoon /> : <FaSun />} {theme === 'light' ? 'Karanlık Mod' : 'Aydınlık Mod'}
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
                      placeholder="Web Address"
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
    <><FaPlusCircle /> Create Token</>
  )}
</button>

{account && (
  <div className="connected-wallet">
    <p>Connected Wallet: {account}</p>
  </div>
)}

                </form>
              </div>

              <div className="instruction-table">
                <h3>Guide</h3>
                <table>
                 
                  <tbody>
                    <tr>
        
                      <td><strong>Token İsmi:</strong> Oluşturmak istediğiniz tokenin adını girin.</td>
                    </tr>
                    <tr>
         
                      <td><strong>Token Sembolü:</strong> Tokenin kısa sembolünü (örneğin, MTK) girin.</td>
                    </tr>
                    <tr>
          
                      <td><strong>Toplam Arz:</strong> Oluşturulacak toplam token miktarını girin.</td>
                    </tr>
                    <tr>
            
                      <td><strong>Ondalık Sayısı:</strong> Tokenin ondalık hassasiyetini belirleyin (genellikle 18).</td>
                    </tr>
                    <tr>
             
                      <td><strong>Web Sitesi:</strong> Tokeninizin resmi web sitesinin URL'sini girin.</td>
                    </tr>
                    <tr>
              
                      <td><strong>Listeleme:</strong> Tokeninizin "Tüm Tokenler" listesinde görünmesini istiyor musunuz? Seçiminizi yapın.</td>
                    </tr>
                    <tr>
      
                      <td><strong>Token Oluştur:</strong> Girdiğiniz bilgileri kontrol edin ve "Token Oluştur" butonuna tıklayın.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Oluşturulan Token Adresi */}
            {tokenAddress && (
              <div className={`token-address ${listInAllTokens ? '' : 'hidden'}`}>
                <h3>{listInAllTokens ? 'Oluşturulan Token Adresi:' : 'Oluşturulan Token Adresi (Listeye Eklenmedi):'}</h3>
                <p>{tokenAddress}</p>
                <button
                  className="copy-button"
                  onClick={() => {
                    navigator.clipboard.writeText(tokenAddress);
                    alert('Token adresi kopyalandı!');
                  }}
                >
                  <FaCopy /> Adresi Kopyala
                </button>
              </div>
            )}
          </section>
        )}

        {activeMenu === 'list' && (
          <section className="list-section">
            <div className="all-tokens">
              <h2>Tüm Oluşturulan Tokenler</h2>
              {loadingTokens ? (
                <p className="loading-text">Tokenler yükleniyor...</p>
              ) : allTokens.length > 0 ? (
                <>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Token İsmi</th>
                          <th>Sembol</th>
                          <th>Toplam Arz</th>
                          <th>Ondalık Sayısı</th>
                          <th>Web Sitesi</th>
                          <th>Token Adresi</th>
                          <th>Kopyala</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTokens.map((token, index) => (
                          <tr key={token.address}>
                            <td>{token.name}</td>
                            <td>{token.symbol}</td>
                            <td>{token.totalSupply}</td>
                            <td>{token.decimals}</td>
                            <td>
                              {token.website ? (
                                <a href={token.website} target="_blank" rel="noopener noreferrer">
                                  {token.website}
                                </a>
                              ) : (
                                'Yok'
                              )}
                            </td>
                            <td>{token.address}</td>
                            <td>
                              <button
                                className="copy-button"
                                onClick={() => {
                                  navigator.clipboard.writeText(token.address);
                                  alert('Token adresi kopyalandı!');
                                }}
                              >
                                <FaCopy /> Kopyala
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
                      Önceki
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
                      Sonraki
                    </button>
                  </div>
                </>
              ) : (
                <p className="no-tokens">Henüz oluşturulmuş bir token bulunmuyor.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
