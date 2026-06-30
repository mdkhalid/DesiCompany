import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

// Connectivity state
class ConnectivityState {
  final bool isOnline;
  final ConnectivityResult connectionType;

  const ConnectivityState({
    this.isOnline = true,
    this.connectionType = ConnectivityResult.wifi,
  });

  ConnectivityState copyWith({
    bool? isOnline,
    ConnectivityResult? connectionType,
  }) {
    return ConnectivityState(
      isOnline: isOnline ?? this.isOnline,
      connectionType: connectionType ?? this.connectionType,
    );
  }
}

// Connectivity notifier
class ConnectivityNotifier extends StateNotifier<ConnectivityState> {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  ConnectivityNotifier() : super(const ConnectivityState()) {
    _init();
  }

  Future<void> _init() async {
    // Check initial connectivity
    final result = await _connectivity.checkConnectivity();
    _updateConnection(result.first);

    // Listen for connectivity changes
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      _updateConnection(results.first);
    });
  }

  void _updateConnection(ConnectivityResult result) {
    final isOnline = result != ConnectivityResult.none;
    state = state.copyWith(
      isOnline: isOnline,
      connectionType: result,
    );
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

// Connectivity provider
final connectivityProvider = StateNotifierProvider<ConnectivityNotifier, ConnectivityState>((ref) {
  return ConnectivityNotifier();
});

// Convenience providers
final isOnlineProvider = Provider<bool>((ref) {
  return ref.watch(connectivityProvider).isOnline;
});

final connectionTypeProvider = Provider<ConnectivityResult>((ref) {
  return ref.watch(connectivityProvider).connectionType;
});
