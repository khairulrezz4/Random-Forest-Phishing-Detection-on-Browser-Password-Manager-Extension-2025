import pickle

with open('model.pkl','rb') as f:
    active = pickle.load(f)
with open('model_TarunTiwari_PhiUSIIL.pkl','rb') as f:
    newb = pickle.load(f)

def sig(x):
    return (
        x.get('model_name'),
        tuple(x.get('features', [])[:10]),
        type(x.get('scaler')).__name__,
        x.get('metrics'),
    )

sa = sig(active)
sb = sig(newb)
print('ACTIVE model signature:', sa)
print('NEW bundle signature  :', sb)
print('\nMatches:', sa == sb)
