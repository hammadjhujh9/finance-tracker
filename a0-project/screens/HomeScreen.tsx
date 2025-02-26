import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons, AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

const FinanceTracker = () => {
  // State Management
  const [cashInHand, setCashInHand] = useState(0);
  const [loanAmount, setLoanAmount] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('week');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Default categories for expenses
  const expenseCategories = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Other'];
  const [selectedCategory, setSelectedCategory] = useState('Other');

  // Calculate totals and net balance
  useEffect(() => {
    calculateBalances();
  }, [transactions]);

  const calculateBalances = () => {
    let cash = 0;
    let loan = 0;

    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        cash += transaction.amount;
      } else if (transaction.type === 'expense') {
        cash -= transaction.amount;
      } else if (transaction.type === 'debt') {
        loan += transaction.amount;
      } else if (transaction.type === 'loan-payment') {
        loan -= transaction.amount;
        cash -= transaction.amount;
      }
    });

    setCashInHand(cash);
    setLoanAmount(loan);
    setNetBalance(loan > 0 ? -loan : cash);
  };

  // Add new transaction
  const addTransaction = () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const parsedAmount = parseFloat(amount);

    // For loan payments, check if amount is greater than loan
    if (transactionType === 'loan-payment' && parsedAmount > loanAmount) {
      alert(`You can't pay more than your current loan amount of Rs ${loanAmount.toFixed(2)}`);
      return;
    }

    // For expenses, check if amount is greater than cash in hand
    if (transactionType === 'expense') {
      if (parsedAmount > cashInHand) {
        const remainingCash = cashInHand;
        const debtAmount = parsedAmount - cashInHand;
        
        // Create expense transaction for available cash
        if (remainingCash > 0) {
          const expenseTransaction = {
            id: Date.now().toString(),
            type: 'expense',
            amount: remainingCash,
            description: description,
            category: selectedCategory,
            date: new Date(),
          };
          setTransactions(prev => [expenseTransaction, ...prev]);
        }

        // Create debt transaction for remaining amount
        const debtTransaction = {
          id: (Date.now() + 1).toString(),
          type: 'debt',
          amount: debtAmount,
          description: `Debt from: ${description}`,
          category: selectedCategory,
          date: new Date(),
        };
        
        setTransactions(prev => [debtTransaction, ...prev]);
        resetForm();
        setModalVisible(false);
        return;
      }
    }

    // Normal transaction flow for other cases
    const newTransaction = {
      id: Date.now().toString(),
      type: transactionType,
      amount: parsedAmount,
      description: description,
      category: transactionType === 'expense' ? selectedCategory : null,
      date: new Date(),
    };

    setTransactions([newTransaction, ...transactions]);
    resetForm();
    setModalVisible(false);
  };

  // Reset form fields
  const resetForm = () => {
    setAmount('');
    setDescription('');
    setSelectedCategory('Other');
  };

  // Open transaction modal with specific type
  const openTransactionModal = (type) => {
    setTransactionType(type);
    setModalVisible(true);
  };

  // Format currency
  const formatCurrency = (value) => {
    return `Rs. ${value.toFixed(2)}`;
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get filtered transactions based on time range
  const getFilteredTransactions = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (selectedTimeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(0); // All time
    }
    
    let filtered = transactions.filter(t => new Date(t.date) >= startDate);
    
    // Apply category filter if set and not 'all'
    if (selectedCategoryFilter !== 'all' && activeTab === 'analytics') {
      filtered = filtered.filter(t => 
        t.type === 'expense' && t.category === selectedCategoryFilter
      );
    }
    
    return filtered;
  };

  // Get expense data for charts
  const getExpenseData = () => {
    const filteredTransactions = getFilteredTransactions();
    const expensesByCategory = {};
    
    // Initialize categories
    expenseCategories.forEach(category => {
      expensesByCategory[category] = 0;
    });
    
    // Sum expenses by category
    filteredTransactions.forEach(transaction => {
      if (transaction.type === 'expense' && transaction.category) {
        expensesByCategory[transaction.category] += transaction.amount;
      }
    });
    
    // Format for pie chart
    return expenseCategories.map((category, index) => {
      const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
      ];
      
      return {
        name: category,
        amount: expensesByCategory[category],
        color: colors[index % colors.length],
        legendFontColor: '#7F7F7F',
        legendFontSize: 12
      };
    }).filter(item => item.amount > 0);
  };

  // Get time-series data for line chart
  const getTimeSeriesData = () => {
    const filteredTransactions = getFilteredTransactions();
    const dateFormat = selectedTimeRange === 'week' ? 'day' : 
                     selectedTimeRange === 'month' ? 'week' : 'month';
    
    const incomeByDate = {};
    const expenseByDate = {};
    const labels = [];
    
    // Generate date labels
    const now = new Date();
    if (selectedTimeRange === 'week') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const label = date.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(label);
        incomeByDate[label] = 0;
        expenseByDate[label] = 0;
      }
    } else if (selectedTimeRange === 'month') {
      for (let i = 0; i < 4; i++) {
        const label = `Week ${i+1}`;
        labels.push(label);
        incomeByDate[label] = 0;
        expenseByDate[label] = 0;
      }
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach(month => {
        labels.push(month);
        incomeByDate[month] = 0;
        expenseByDate[month] = 0;
      });
    }
    
    // Calculate sums by date
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      let label;
      
      if (selectedTimeRange === 'week') {
        label = date.toLocaleDateString('en-US', { weekday: 'short' });
      } else if (selectedTimeRange === 'month') {
        const weekOfMonth = Math.ceil((date.getDate() + (date.getDay() + 1)) / 7);
        label = `Week ${weekOfMonth}`;
      } else {
        label = date.toLocaleDateString('en-US', { month: 'short' });
      }
      
      if (transaction.type === 'income') {
        incomeByDate[label] = (incomeByDate[label] || 0) + transaction.amount;
      } else if (transaction.type === 'expense') {
        expenseByDate[label] = (expenseByDate[label] || 0) + transaction.amount;
      }
    });
    
    return {
      labels,
      datasets: [
        {
          data: labels.map(label => incomeByDate[label] || 0),
          color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
          strokeWidth: 2
        },
        {
          data: labels.map(label => expenseByDate[label] || 0),
          color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
          strokeWidth: 2
        }
      ],
      legend: ['Income', 'Expenses']
    };
  };

  // Add delete transaction function
  const deleteTransaction = (transactionId) => {
    setTransactions(prev => prev.filter(t => t.id !== transactionId));
  };

  // Add edit transaction function
  const editTransaction = (updatedTransaction) => {
    setTransactions(prev => 
      prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t)
    );
    setEditingTransaction(null);
    setEditModalVisible(false);
    resetForm();
  };

  // Add renderRightActions for edit
  const renderRightActions = (transaction) => {
    return (
      <TouchableOpacity
        style={styles.rightAction}
        onPress={() => {
          setEditingTransaction(transaction);
          setAmount(transaction.amount.toString());
          setDescription(transaction.description);
          if (transaction.category) {
            setSelectedCategory(transaction.category);
          }
          setTransactionType(transaction.type);
          setEditModalVisible(true);
        }}
      >
        <MaterialIcons name="edit" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  // Add renderLeftActions for delete
  const renderLeftActions = (transaction) => {
    return (
      <TouchableOpacity
        style={styles.leftAction}
        onPress={() => {
          Alert.alert(
            "Delete Transaction",
            "Are you sure you want to delete this transaction?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => deleteTransaction(transaction.id) }
            ]
          );
        }}
      >
        <MaterialIcons name="delete" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  // Dashboard component
  const DashboardScreen = () => (
    <ScrollView style={styles.dashboardContainer}>
      <LinearGradient
        colors={['#6441A5', '#2a0845']}
        style={styles.balanceCard}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceTitle}>Net Balance</Text>
          <Text style={[styles.balanceAmount, netBalance < 0 && styles.negativeAmount]}>
            {formatCurrency(netBalance)}
          </Text>
        </View>
        
        <View style={styles.balanceDetails}>
          <View style={styles.balanceItem}>
            <FontAwesome5 name="wallet" size={20} color="#fff" />
            <Text style={styles.balanceItemTitle}>Cash In Hand</Text>
            <Text style={styles.balanceItemAmount}>{formatCurrency(cashInHand)}</Text>
          </View>
          
          <View style={styles.balanceDivider} />
          
          <View style={styles.balanceItem}>
            <FontAwesome5 name="hand-holding-usd" size={20} color="#fff" />
            <Text style={styles.balanceItemTitle}>Loan Amount</Text>
            <Text style={styles.balanceItemAmount}>{formatCurrency(loanAmount)}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.incomeButton]} 
          onPress={() => openTransactionModal('income')}
        >
          <AntDesign name="arrowdown" size={24} color="#27ae60" />
          <Text style={styles.actionButtonText}>Add Income</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.expenseButton]} 
          onPress={() => openTransactionModal('expense')}
        >
          <AntDesign name="arrowup" size={24} color="#e74c3c" />
          <Text style={styles.actionButtonText}>Add Expense</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.debtButton]} 
          onPress={() => openTransactionModal('debt')}
        >
          <FontAwesome5 name="credit-card" size={22} color="#3498db" />
          <Text style={styles.actionButtonText}>Add Debt</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.payLoanButton]} 
          onPress={() => openTransactionModal('loan-payment')}
          disabled={loanAmount <= 0 || cashInHand <= 0}
          opacity={loanAmount <= 0 || cashInHand <= 0 ? 0.5 : 1}
        >
          <MaterialIcons name="payments" size={24} color="#9b59b6" />
          <Text style={styles.actionButtonText}>Pay Loan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentTransactionsContainer}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyTransactions}>
            <Image
              source={{ uri: 'https://api.a0.dev/assets/image?text=empty%20list%20with%20financial%20documents&aspect=1:1' }}
              style={styles.emptyImage}
            />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubText}>Add your first transaction using the buttons above</Text>
          </View>
        ) : (
          transactions.slice(0, 5).map(transaction => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionIconContainer}>
                {transaction.type === 'income' && <AntDesign name="arrowdown" size={18} color="#27ae60" />}
                {transaction.type === 'expense' && <AntDesign name="arrowup" size={18} color="#e74c3c" />}
                {transaction.type === 'debt' && <FontAwesome5 name="credit-card" size={16} color="#3498db" />}
                {transaction.type === 'loan-payment' && <MaterialIcons name="payments" size={18} color="#9b59b6" />}
              </View>
              
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>
                  {transaction.description || getDefaultDescription(transaction.type)}
                </Text>
                {transaction.type === 'expense' && transaction.category && (
                  <Text style={styles.transactionCategory}>{transaction.category}</Text>
                )}
                <Text style={styles.transactionDate}>{formatDate(transaction.date)}</Text>
              </View>
              
              <Text 
                style={[
                  styles.transactionAmount,
                  (transaction.type === 'income') ? styles.incomeAmount : 
                  (transaction.type === 'expense' || transaction.type === 'loan-payment') ? styles.expenseAmount : 
                  styles.debtAmount
                ]}
              >
                {transaction.type === 'income' ? '+' : transaction.type === 'debt' ? '' : '-'}
                {formatCurrency(transaction.amount)}
              </Text>
            </View>
          ))
        )}
        
        {transactions.length > 5 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => setActiveTab('transactions')}
          >
            <Text style={styles.viewAllText}>View All Transactions</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  // Transactions Screen
  const TransactionsScreen = () => (
    <View style={styles.screenContainer}>
      {transactions.length === 0 ? (
        <View style={styles.emptyTransactions}>
          <Image
            source={{ uri: 'https://api.a0.dev/assets/image?text=empty%20list%20with%20financial%20documents&aspect=1:1' }}
            style={styles.emptyImage}
          />
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubText}>Your transactions will appear here</Text>
        </View>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable
                renderRightActions={() => renderRightActions(item)}
                renderLeftActions={() => renderLeftActions(item)}
              >
                <View style={styles.transactionItem}>
                  <View style={styles.transactionIconContainer}>
                    {item.type === 'income' && <AntDesign name="arrowdown" size={18} color="#27ae60" />}
                    {item.type === 'expense' && <AntDesign name="arrowup" size={18} color="#e74c3c" />}
                    {item.type === 'debt' && <FontAwesome5 name="credit-card" size={16} color="#3498db" />}
                    {item.type === 'loan-payment' && <MaterialIcons name="payments" size={18} color="#9b59b6" />}
                  </View>
                  
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription}>
                      {item.description || getDefaultDescription(item.type)}
                    </Text>
                    {item.type === 'expense' && item.category && (
                      <Text style={styles.transactionCategory}>{item.category}</Text>
                    )}
                    <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
                  </View>
                  
                  <Text 
                    style={[
                      styles.transactionAmount,
                      (item.type === 'income') ? styles.incomeAmount : 
                      (item.type === 'expense' || item.type === 'loan-payment') ? styles.expenseAmount : 
                      styles.debtAmount
                    ]}
                  >
                    {item.type === 'income' ? '+' : item.type === 'debt' ? '' : '-'}
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              </Swipeable>
            )}
            showsVerticalScrollIndicator={false}
          />
        </GestureHandlerRootView>
      )}

      {/* Edit Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => {
          setEditModalVisible(false);
          setEditingTransaction(null);
          resetForm();
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Transaction</Text>
              <TouchableOpacity 
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingTransaction(null);
                  resetForm();
                }}
              >
                <Ionicons name="close-circle" size={28} color="#6441A5" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>Rs.</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter description"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {editingTransaction?.type === 'expense' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryContainer}
                >
                  {expenseCategories.map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        selectedCategory === category && styles.selectedCategoryButton
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text 
                        style={[
                          styles.categoryButtonText,
                          selectedCategory === category && styles.selectedCategoryButtonText
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                if (editingTransaction) {
                  const updatedTransaction = {
                    ...editingTransaction,
                    amount: parseFloat(amount),
                    description: description,
                    category: editingTransaction.type === 'expense' ? selectedCategory : null,
                  };
                  editTransaction(updatedTransaction);
                }
              }}
            >
              <Text style={styles.addButtonText}>Update Transaction</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );

  // Analytics Screen
  const AnalyticsScreen = () => {
    const expenseData = getExpenseData();
    const timeSeriesData = getTimeSeriesData();
    
    return (
      <ScrollView style={styles.analyticsContainer}>
        <View style={styles.timeRangeSelector}>
          <TouchableOpacity 
            style={[styles.timeRangeButton, selectedTimeRange === 'week' && styles.selectedTimeRange]}
            onPress={() => setSelectedTimeRange('week')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'week' && styles.selectedTimeRangeText]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeRangeButton, selectedTimeRange === 'month' && styles.selectedTimeRange]}
            onPress={() => setSelectedTimeRange('month')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'month' && styles.selectedTimeRangeText]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.timeRangeButton, selectedTimeRange === 'year' && styles.selectedTimeRange]}
            onPress={() => setSelectedTimeRange('year')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'year' && styles.selectedTimeRangeText]}>
              Year
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Income vs Expenses</Text>
          {timeSeriesData.datasets[0].data.some(val => val > 0) || 
           timeSeriesData.datasets[1].data.some(val => val > 0) ? (
            <LineChart
              data={timeSeriesData}
              width={Dimensions.get('window').width - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No data available for the selected period</Text>
            </View>
          )}
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Expenses by Category</Text>
          <View style={styles.categoryFilterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity 
                style={[styles.categoryFilterButton, selectedCategoryFilter === 'all' && styles.selectedCategoryFilter]}
                onPress={() => setSelectedCategoryFilter('all')}
              >
                <Text style={[styles.categoryFilterText, selectedCategoryFilter === 'all' && styles.selectedCategoryFilterText]}>
                  All
                </Text>
              </TouchableOpacity>
              {expenseCategories.map(category => (
                <TouchableOpacity 
                  key={category}
                  style={[styles.categoryFilterButton, selectedCategoryFilter === category && styles.selectedCategoryFilter]}
                  onPress={() => setSelectedCategoryFilter(category)}
                >
                  <Text style={[styles.categoryFilterText, selectedCategoryFilter === category && styles.selectedCategoryFilterText]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {expenseData.length > 0 ? (
            <PieChart
              data={expenseData}
              width={Dimensions.get('window').width - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No expense data available for the selected period</Text>
            </View>
          )}
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Financial Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total Income</Text>
              <Text style={styles.summaryItemValue}>
                {formatCurrency(getFilteredTransactions()
                  .filter(t => t.type === 'income')
                  .reduce((sum, t) => sum + t.amount, 0)
                )}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total Expenses</Text>
              <Text style={styles.summaryItemValue}>
                {formatCurrency(getFilteredTransactions()
                  .filter(t => t.type === 'expense')
                  .reduce((sum, t) => sum + t.amount, 0)
                )}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>New Debt</Text>
              <Text style={styles.summaryItemValue}>
                {formatCurrency(getFilteredTransactions()
                  .filter(t => t.type === 'debt')
                  .reduce((sum, t) => sum + t.amount, 0)
                )}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Loan Payments</Text>
              <Text style={styles.summaryItemValue}>
                {formatCurrency(getFilteredTransactions()
                  .filter(t => t.type === 'loan-payment')
                  .reduce((sum, t) => sum + t.amount, 0)
                )}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  // Get default description based on transaction type
  const getDefaultDescription = (type) => {
    switch (type) {
      case 'income': return 'Income';
      case 'expense': return 'Expense';
      case 'debt': return 'New Debt';
      case 'loan-payment': return 'Loan Payment';
      default: return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#6441A5', '#2a0845']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Finance Tracker</Text>
      </LinearGradient>

      {/* Main Content */}
      <View style={styles.content}>
        {activeTab === 'dashboard' && <DashboardScreen />}
        {activeTab === 'transactions' && <TransactionsScreen />}
        {activeTab === 'analytics' && <AnalyticsScreen />}
      </View>

      {/* Add Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {transactionType === 'income' ? 'Add Income' : 
                 transactionType === 'expense' ? 'Add Expense' : 
                 transactionType === 'debt' ? 'Add Debt' : 'Pay Loan'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#6441A5" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>Rs.</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter description"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {transactionType === 'expense' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryContainer}
                >
                  {expenseCategories.map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        selectedCategory === category && styles.selectedCategoryButton
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text 
                        style={[
                          styles.categoryButtonText,
                          selectedCategory === category && styles.selectedCategoryButtonText
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {transactionType === 'loan-payment' && loanAmount > 0 && (
              <View style={styles.loanPaymentInfo}>
                <Text style={styles.loanPaymentText}>
                  Current loan amount: {formatCurrency(loanAmount)}
                </Text>
                <Text style={styles.loanPaymentText}>
                  Available cash: {formatCurrency(cashInHand)}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.addButton}
              onPress={addTransaction}
            >
              <Text style={styles.addButtonText}>
                {transactionType === 'income' ? 'Add Income' : 
                 transactionType === 'expense' ? 'Add Expense' : 
                 transactionType === 'debt' ? 'Add Debt' : 'Make Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'dashboard' && styles.activeNavItem]} 
          onPress={() => setActiveTab('dashboard')}
        >
          <MaterialIcons 
            name="dashboard" 
            size={24} 
            color={activeTab === 'dashboard' ? '#6441A5' : '#666'} 
          />
          <Text 
            style={[styles.navText, activeTab === 'dashboard' && styles.activeNavText]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'transactions' && styles.activeNavItem]} 
          onPress={() => setActiveTab('transactions')}
        >
          <FontAwesome5 
            name="exchange-alt" 
            size={20} 
            color={activeTab === 'transactions' ? '#6441A5' : '#666'} 
          />
          <Text 
            style={[styles.navText, activeTab === 'transactions' && styles.activeNavText]}
          >
            Transactions
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'analytics' && styles.activeNavItem]} 
          onPress={() => setActiveTab('analytics')}
        >
          <Ionicons 
            name="stats-chart" 
            size={24} 
            color={activeTab === 'analytics' ? '#6441A5' : '#666'} 
          />
          <Text 
            style={[styles.navText, activeTab === 'analytics' && styles.activeNavText]}
          >
            Analytics
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  dashboardContainer: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  balanceHeader: {
    marginBottom: 20,
  },
  balanceTitle: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
    marginBottom: 4,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  negativeAmount: {
    color: '#ff7675',
  },
  balanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  balanceItemTitle: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
    marginVertical: 4,
  },
  balanceItemAmount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  incomeButton: {
    borderLeftWidth: 3,
    borderLeftColor: '#27ae60',
  },
  expenseButton: {
    borderLeftWidth: 3,
    borderLeftColor: '#e74c3c',
  },
  debtButton: {
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  payLoanButton: {
    borderLeftWidth: 3,
    borderLeftColor: '#9b59b6',
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  recentTransactionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  transactionItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  transactionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  transactionCategory: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  incomeAmount: {
    color: '#27ae60',
  },
  expenseAmount: {
    color: '#e74c3c',
  },
  debtAmount: {
    color: '#3498db',
  },
  viewAllButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  viewAllText: {
    color: '#6441A5',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  currencySymbol: {
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 12,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    paddingRight: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  selectedCategoryButton: {
    backgroundColor: '#6441A5',
  },
  categoryButtonText: {
    color: '#333',
  },
  selectedCategoryButtonText: {
    color: '#fff',
  },
  loanPaymentInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  loanPaymentText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  addButton: {
    backgroundColor: '#6441A5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  activeNavItem: {
    borderTopWidth: 3,
    borderTopColor: '#6441A5',
    paddingTop: 0,
    marginTop: -3,
  },
  navText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
  },
  activeNavText: {
    color: '#6441A5',
    fontWeight: '500',
  },
  screenContainer: {
    flex: 1,
    padding: 16,
  },
  emptyTransactions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  analyticsContainer: {
    flex: 1,
    padding: 16,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
  },
  selectedTimeRange: {
    backgroundColor: '#6441A5',
  },
  timeRangeText: {
    color: '#333',
  },
  selectedTimeRangeText: {
    color: '#fff',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  chart: {
    borderRadius: 16,
  },
  categoryFilterContainer: {
    marginBottom: 16,
  },
  categoryFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  selectedCategoryFilter: {
    backgroundColor: '#6441A5',
  },
  categoryFilterText: {
    color: '#333',
    fontSize: 12,
  },
  selectedCategoryFilterText: {
    color: '#fff',
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: '#999',
    fontSize: 14,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  summaryItemLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryItemValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  leftAction: {
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    width: 80,
  },
  rightAction: {
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    width: 80,
  },
});

export default FinanceTracker;