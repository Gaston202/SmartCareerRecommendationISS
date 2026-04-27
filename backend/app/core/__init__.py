import sys

# Mock pyiceberg before importing supabase to avoid dependency issues
class MockPyiceberg:
    class catalog:
        class rest:
            RestCatalog = object

sys.modules['pyiceberg'] = MockPyiceberg()
sys.modules['pyiceberg.catalog'] = MockPyiceberg.catalog
sys.modules['pyiceberg.catalog.rest'] = MockPyiceberg.catalog.rest
