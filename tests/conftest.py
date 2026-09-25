import os,pytest
@pytest.fixture(autouse=True)
def windows_lock(monkeypatch):
    real=os.unlink
    def unlink(path,*a,**k):
        try:return real(path,*a,**k)
        except PermissionError:
            if str(path).endswith('.py'):raise
    monkeypatch.setattr(os,'unlink',unlink)
